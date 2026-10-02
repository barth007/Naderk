"""Joining a call: who, when, and how presence moves the session along."""
import datetime

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.core.models import User
from naderk.medical_records.models import ConsultationEncounter
from naderk.telehealth.models import TelehealthEvent, TelehealthParticipant, TelehealthSession
from naderk.telehealth.services.session_lifecycle import end_session, join_session, leave_session
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

S = TelehealthSession.Status
SESSIONS = '/api/v1/telehealth/sessions/'


@pytest.fixture
def session(patient, doctor):
    appt = factories.appointment(
        patient, factories.service('consult', minutes=45), doctor, paid=True,
        status=Appointment.Status.CONFIRMED, kind=Appointment.AppointmentType.TELEHEALTH,
    )
    return TelehealthSession.objects.get(appointment=appt)


def starting_in(session, **delta):
    start = timezone.now() + datetime.timedelta(**delta)
    TelehealthSession.objects.filter(pk=session.pk).update(scheduled_start=start)
    session.refresh_from_db()
    return session


def join(user, session):
    return client_for(user).post(f'{SESSIONS}{session.id}/join/')


# ── Creation from the appointment ────────────────────────────────────────────

def test_session_is_scheduled_for_the_appointment_slot_and_service_length(session):
    appt = session.appointment
    start = timezone.make_aware(datetime.datetime.combine(appt.appointment_date, appt.appointment_time))

    assert (session.scheduled_start, session.scheduled_end) == (start, start + datetime.timedelta(minutes=45))
    assert (session.patient, session.doctor) == (appt.patient, appt.doctor)
    assert session.conversation is not None
    appt.refresh_from_db()
    assert appt.meeting_link == f'/dashboard/telehealth/{session.id}'


def test_a_physical_appointment_gets_no_session(patient, doctor):
    factories.appointment(patient, factories.service(), doctor, paid=True, status=Appointment.Status.CONFIRMED)

    assert not TelehealthSession.objects.exists()


# ── The join endpoint ────────────────────────────────────────────────────────

def test_patient_gets_a_room_token_inside_the_join_window(patient, session):
    starting_in(session, minutes=10)

    res = join(patient, session)

    assert res.status_code == 200, res.content
    data = res.json()['data']
    assert data['room_name'] == session.room_name
    assert data['token'] and data['server_url'].startswith('ws')


def test_patient_cannot_join_more_than_thirty_minutes_early(patient, session):
    starting_in(session, minutes=45)

    res = join(patient, session)

    assert res.status_code == 403
    assert '30 minutes' in res.json()['detail']
    assert not TelehealthParticipant.objects.exists()


def test_doctor_may_open_the_room_early(doctor, session):
    starting_in(session, hours=5)

    assert join(doctor, session).status_code == 200


def test_rejoining_a_call_that_is_running_late_still_works(patient, session):
    starting_in(session, hours=-2)

    assert join(patient, session).status_code == 200


@pytest.mark.parametrize('role', [User.Role.PATIENT, User.Role.DOCTOR, User.Role.ADMIN, User.Role.AGENT])
def test_nobody_else_can_join(session, role):
    outsider = make_user('outsider@naderk.test', role=role)

    assert join(outsider, session).status_code == 403
    assert not TelehealthParticipant.objects.exists()


def test_join_refusals(patient, api_client, session):
    assert api_client.post(f'{SESSIONS}{session.id}/join/').status_code == 401
    assert client_for(patient).post(f'{SESSIONS}00000000-0000-0000-0000-000000000000/join/').status_code == 404
    assert client_for(patient).post('/api/v1/telehealth/token/', {}, format='json').status_code == 400


def test_token_route_takes_the_session_id_in_the_body(doctor, session):
    res = client_for(doctor).post('/api/v1/telehealth/token/', {'session_id': str(session.id)}, format='json')

    assert res.status_code == 200, res.content


# ── Presence ─────────────────────────────────────────────────────────────────

def test_status_follows_who_is_in_the_room(patient, doctor, session):
    join_session(session=session, user=patient)
    assert session.status == S.WAITING_ROOM

    join_session(session=session, user=doctor)
    session.refresh_from_db()
    assert session.status == S.ACTIVE
    assert session.started_at is not None
    session.appointment.refresh_from_db()
    assert session.appointment.status == Appointment.Status.IN_PROGRESS

    leave_session(session=session, user=doctor)
    session.refresh_from_db()
    assert session.status == S.WAITING_ROOM

    leave_session(session=session, user=patient)
    session.refresh_from_db()
    assert session.status == S.SCHEDULED


def test_doctor_alone_is_a_distinct_waiting_state(doctor, session):
    join_session(session=session, user=doctor)

    assert session.status == S.WAITING_FOR_DOCTOR


def test_rejoining_keeps_the_first_join_time_and_the_original_start(patient, doctor, session):
    first = join_session(session=session, user=patient).joined_at
    join_session(session=session, user=doctor)
    session.refresh_from_db()
    started = session.started_at
    leave_session(session=session, user=patient)

    again = join_session(session=session, user=patient)

    session.refresh_from_db()
    assert again.joined_at == first
    assert session.started_at == started
    assert TelehealthParticipant.objects.filter(session=session).count() == 2


@pytest.mark.xfail(strict=True, reason=(
    'Every time a dropped participant reconnects, join_session sees the status return to ACTIVE and '
    'logs another STARTED event and sends the patient another "Consultation Started" notification.'
))
def test_a_reconnect_does_not_announce_the_start_again(patient, doctor, session):
    join_session(session=session, user=patient)
    join_session(session=session, user=doctor)
    leave_session(session=session, user=patient)

    join_session(session=session, user=patient)

    assert session.events.filter(event_type=TelehealthEvent.EventType.STARTED).count() == 1


def test_leaving_a_room_you_never_joined_is_a_no_op(patient, session):
    assert leave_session(session=session, user=patient) is None


def test_joins_are_audited(patient, doctor, session):
    join_session(session=session, user=patient)
    join_session(session=session, user=doctor)

    events = list(session.events.order_by('created_at').values_list('event_type', 'actor__email'))
    assert events[-3:] == [
        ('PATIENT_JOINED', patient.email), ('DOCTOR_JOINED', doctor.email), ('STARTED', None),
    ]


# ── Ending ───────────────────────────────────────────────────────────────────

def test_ending_records_the_duration_and_writes_the_medical_record(patient, doctor, session):
    join_session(session=session, user=patient)
    join_session(session=session, user=doctor)
    TelehealthSession.objects.filter(pk=session.pk).update(started_at=timezone.now() - datetime.timedelta(minutes=25))
    session.refresh_from_db()
    session.session_notes = 'Stable'
    session.save()

    end_session(session=session, user=doctor)

    session.refresh_from_db()
    assert (session.status, session.duration_minutes) == (S.COMPLETED, 25)
    encounter = ConsultationEncounter.objects.get(telehealth_session=session)
    assert (encounter.patient, encounter.doctor, encounter.notes) == (patient, doctor, 'Stable')
    assert not session.participants.filter(connection_status='CONNECTED').exists()
    session.appointment.refresh_from_db()
    assert session.appointment.status == Appointment.Status.COMPLETED
    session.conversation.refresh_from_db()
    assert session.conversation.status == 'CLOSED'


def test_ending_twice_does_not_duplicate_the_record(doctor, session):
    end_session(session=session, user=doctor)
    end_session(session=session, user=doctor)

    assert ConsultationEncounter.objects.filter(telehealth_session=session).count() == 1
    assert session.events.filter(event_type='ENDED').count() == 1


def test_a_session_that_never_started_ends_with_zero_duration(doctor, session):
    end_session(session=session, user=doctor)

    session.refresh_from_db()
    assert session.duration_minutes == 0


def test_completing_through_the_api_fills_in_the_clinical_fields(doctor, session):
    res = client_for(doctor).post(f'/api/v1/telehealth/session/{session.id}/complete/', {
        'session_notes': 'Stable', 'diagnosis': 'Mild myopia', 'recommendations': 'Review in 6 months',
        'follow_up_date': '2030-01-15',
    }, format='json')

    assert res.status_code == 200, res.content
    encounter = ConsultationEncounter.objects.get(telehealth_session=session)
    assert (encounter.diagnosis, encounter.recommendations) == ('Mild myopia', 'Review in 6 months')
    assert res.json()['data']['encounter_id'] == str(encounter.id)


# ── Listing and detail ───────────────────────────────────────────────────────

def test_list_is_grouped_and_scoped_to_the_user(patient, other_patient, doctor, session):
    def groups(user):
        data = client_for(user).get(SESSIONS).json()['data']
        return {name: [row['id'] for row in rows] for name, rows in data.items()}

    assert groups(patient) == {'active': [], 'upcoming': [str(session.id)], 'past': []}
    assert groups(doctor)['upcoming'] == [str(session.id)]
    assert groups(other_patient) == {'active': [], 'upcoming': [], 'past': []}

    join_session(session=session, user=patient)
    join_session(session=session, user=doctor)
    assert groups(patient)['active'] == [str(session.id)]

    end_session(session=session, user=doctor)
    assert groups(patient) == {'active': [], 'upcoming': [], 'past': [str(session.id)]}


def test_oversight_staff_see_every_session_and_can_open_one(admin_user, other_patient, session):
    listed = client_for(admin_user).get(SESSIONS).json()['data']['upcoming']
    detail = f'{SESSIONS}{session.id}/'

    assert [row['id'] for row in listed] == [str(session.id)]
    assert client_for(admin_user).get(detail).status_code == 200
    assert client_for(other_patient).get(detail).status_code == 403
    assert client_for(admin_user).get(f'{SESSIONS}00000000-0000-0000-0000-000000000000/').status_code == 404


# ── Creating a session by hand ───────────────────────────────────────────────

CREATE = '/api/v1/telehealth/session/'


def test_manual_create_returns_the_existing_session(doctor, session):
    res = client_for(doctor).post(CREATE, {'appointment_id': str(session.appointment_id)}, format='json')

    assert res.status_code == 200
    assert res.json()['data']['id'] == str(session.id)
    assert TelehealthSession.objects.count() == 1


def test_manual_create_refuses_physical_or_unconfirmed_appointments(patient, doctor):
    physical = factories.appointment(patient, factories.service('a'), doctor, paid=True,
                                     status=Appointment.Status.CONFIRMED)
    pending = factories.appointment(patient, factories.service('b'), doctor, paid=True, days_ahead=2,
                                    kind=Appointment.AppointmentType.TELEHEALTH)
    client = client_for(doctor)

    assert client.post(CREATE, {'appointment_id': str(physical.id)}, format='json').status_code == 400
    assert client.post(CREATE, {'appointment_id': str(pending.id)}, format='json').status_code == 400
    assert client.post(CREATE, {}, format='json').status_code == 400
    assert client.post(CREATE, {'appointment_id': '00000000-0000-0000-0000-000000000000'}, format='json').status_code == 404
    assert not TelehealthSession.objects.exists()


@pytest.mark.xfail(strict=True, reason=(
    'SessionCreateApi checks only that the caller is signed in, so any user who knows an appointment '
    'id can create (or read back) the telehealth session for someone else\'s appointment.'
))
def test_manual_create_is_limited_to_the_appointments_own_people(other_patient, session):
    res = client_for(other_patient).post(CREATE, {'appointment_id': str(session.appointment_id)}, format='json')

    assert res.status_code == 403
