"""Sessions stay in step with their appointment, and the background jobs that watch them."""
import datetime

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.notifications.models import Notification
from naderk.telehealth.models import TelehealthEvent, TelehealthSession
from naderk.telehealth.services.session_lifecycle import join_session
from naderk.telehealth.tasks import check_missed_sessions, send_session_reminders

pytestmark = pytest.mark.django_db

S = TelehealthSession.Status
A = Appointment.Status


@pytest.fixture
def session(patient, doctor):
    appt = factories.appointment(
        patient, factories.service(), doctor, paid=True,
        status=A.CONFIRMED, kind=Appointment.AppointmentType.TELEHEALTH,
    )
    return TelehealthSession.objects.get(appointment=appt)


def starting_in(session, **delta):
    TelehealthSession.objects.filter(pk=session.pk).update(scheduled_start=timezone.now() + datetime.timedelta(**delta))


def titles_for(user):
    return list(Notification.objects.filter(user=user).values_list('title', flat=True))


# ── Appointment changes ──────────────────────────────────────────────────────

def test_rescheduling_the_appointment_moves_the_session(session):
    appt = session.appointment
    appt.appointment_date += datetime.timedelta(days=2)
    appt.appointment_time = datetime.time(15, 30)
    appt.save()

    session.refresh_from_db()
    start = timezone.make_aware(datetime.datetime.combine(appt.appointment_date, datetime.time(15, 30)))
    assert (session.scheduled_start, session.scheduled_end) == (start, start + datetime.timedelta(minutes=30))
    assert TelehealthSession.objects.count() == 1


def test_cancelling_the_appointment_cancels_the_session_once(session):
    appt = session.appointment
    appt.status = A.CANCELLED
    appt.save()
    appt.save()

    session.refresh_from_db()
    assert session.status == S.CANCELLED
    assert session.events.filter(event_type=TelehealthEvent.EventType.CANCELLED).count() == 1


def test_a_missed_appointment_marks_the_session_missed(session):
    appt = session.appointment
    appt.status = A.NO_SHOW
    appt.save()

    session.refresh_from_db()
    assert session.status == S.MISSED


def test_rebooking_a_missed_appointment_reopens_its_session(session):
    appt = session.appointment
    appt.status = A.NO_SHOW
    appt.save()

    appt.status = A.CONFIRMED
    appt.appointment_date += datetime.timedelta(days=7)
    appt.save()

    session.refresh_from_db()
    assert session.status == S.SCHEDULED
    assert session.scheduled_start.date() >= appt.appointment_date - datetime.timedelta(days=1)


def test_the_patient_is_told_when_a_session_is_scheduled(patient, session):
    assert 'Telehealth Session Scheduled' in titles_for(patient)


# ── Missed-session sweep ─────────────────────────────────────────────────────

def test_a_session_nobody_joined_is_missed_fifteen_minutes_after_its_start(patient, doctor, session):
    starting_in(session, minutes=-16)

    check_missed_sessions()

    session.refresh_from_db()
    session.appointment.refresh_from_db()
    assert (session.status, session.appointment.status) == (S.MISSED, A.NO_SHOW)
    assert session.appointment.missed_at is not None
    assert session.events.filter(event_type='MISSED').get().metadata['detail'] == 'Neither participant joined the room'
    assert 'Telehealth Session Missed' in titles_for(patient)
    assert 'Telehealth Session Missed' in titles_for(doctor)


def test_a_session_within_the_grace_period_is_left_alone(session):
    starting_in(session, minutes=-10)

    check_missed_sessions()

    session.refresh_from_db()
    assert session.status == S.SCHEDULED


def test_the_patient_is_told_when_the_doctor_did_not_show(patient, doctor, session):
    join_session(session=session, user=patient)
    starting_in(session, minutes=-20)

    check_missed_sessions()

    assert 'Consultation Missed' in titles_for(patient)
    assert 'Patient Absent' not in titles_for(doctor)
    assert 'doctor failed to join' in session.events.get(event_type='MISSED').metadata['detail']


def test_the_doctor_is_told_when_the_patient_did_not_show(patient, doctor, session):
    join_session(session=session, user=doctor)
    starting_in(session, minutes=-20)

    check_missed_sessions()

    assert 'Patient Absent' in titles_for(doctor)
    assert 'Consultation Missed' not in titles_for(patient)


def test_a_call_in_progress_is_never_swept(patient, doctor, session):
    join_session(session=session, user=patient)
    join_session(session=session, user=doctor)
    starting_in(session, hours=-3)

    check_missed_sessions()

    session.refresh_from_db()
    assert session.status == S.ACTIVE


# ── Reminders ────────────────────────────────────────────────────────────────

REMINDER = 'Telehealth Session in 15 Mins'


def test_both_sides_are_reminded_about_fifteen_minutes_before(patient, doctor, session):
    starting_in(session, minutes=15)

    send_session_reminders()

    assert REMINDER in titles_for(patient)
    assert REMINDER in titles_for(doctor)


def test_a_reminder_is_sent_only_once(patient, session):
    starting_in(session, minutes=15)

    send_session_reminders()
    send_session_reminders()

    assert titles_for(patient).count(REMINDER) == 1


@pytest.mark.parametrize('minutes', [5, 25, -5])
def test_no_reminder_outside_the_window(patient, session, minutes):
    starting_in(session, minutes=minutes)

    send_session_reminders()

    assert REMINDER not in titles_for(patient)


def test_no_reminder_for_a_cancelled_session(patient, session):
    starting_in(session, minutes=15)
    TelehealthSession.objects.filter(pk=session.pk).update(status=S.CANCELLED)

    send_session_reminders()

    assert REMINDER not in titles_for(patient)
