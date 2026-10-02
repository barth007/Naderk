"""The doctor's home screen: counters, calendar, incoming requests and scratchpad."""
import datetime

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.messaging.tests import factories as messaging
from naderk.telehealth.models import TelehealthSession
from naderk.users.models import DoctorNote
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

BASE = '/api/v1/dashboard/doctor/'
A = Appointment.Status


def test_every_doctor_endpoint_requires_sign_in(api_client):
    for path in ['summary/', 'calendar/', 'appointments/', 'requests/', 'telehealth/', 'scratchpad/']:
        assert api_client.get(BASE + path).status_code == 401, path


def test_summary_counts_real_bookings_only(patient, other_patient, doctor):
    service = factories.service()
    factories.appointment(patient, service, doctor, paid=True, days_ahead=0)                       # today, awaiting acceptance
    factories.appointment(other_patient, service, doctor, paid=True, status=A.CONFIRMED)
    factories.appointment(patient, service, doctor, days_ahead=3)                                  # abandoned checkout
    factories.appointment(patient, service, doctor, days_ahead=4, status=A.CANCELLED, paid=True)
    messaging.conversation(patient, doctor=doctor)

    data = client_for(doctor).get(BASE + 'summary/').json()['data']

    assert (data['total_appointments'], data['new_appointments'], data['cancelled_appointments']) == (3, 1, 1)
    assert data['appointments_today'] == 1
    assert (data['active_conversations'], data['unread_messages']) == (1, 1)


def test_summary_counts_telehealth_sessions_by_state(patient, doctor):
    for index, status in enumerate(['SCHEDULED', 'ACTIVE', 'MISSED']):
        appt = factories.appointment(patient, factories.service(f's{index}'), doctor, paid=True, days_ahead=index + 1,
                                     status=A.CONFIRMED, kind=Appointment.AppointmentType.TELEHEALTH)
        TelehealthSession.objects.filter(appointment=appt).update(status=status)

    data = client_for(doctor).get(BASE + 'summary/').json()['data']

    assert (data['upcoming_sessions'], data['active_sessions'], data['missed_sessions']) == (1, 1, 1)


def test_a_doctor_sees_only_their_own_numbers(patient, doctor, admin_user):
    factories.appointment(patient, factories.service(), doctor, paid=True)

    assert client_for(admin_user).get(BASE + 'summary/').json()['data']['total_appointments'] == 0


def test_calendar_is_in_date_order_without_cancelled_or_unpaid(patient, other_patient, doctor):
    service = factories.service()
    later = factories.appointment(patient, service, doctor, paid=True, days_ahead=5)
    sooner = factories.appointment(other_patient, service, doctor, paid=True, days_ahead=2)
    factories.appointment(patient, service, doctor, days_ahead=3, status=A.CANCELLED, paid=True)
    factories.appointment(other_patient, service, doctor, days_ahead=4)

    rows = client_for(doctor).get(BASE + 'calendar/').json()['data']

    assert [row['id'] for row in rows] == [str(sooner.id), str(later.id)]
    assert rows[0]['title'] == 'Other-Patient Test (Consult)'


# ── Requests ─────────────────────────────────────────────────────────────────

def test_accepting_a_request_confirms_it(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)

    res = client_for(doctor).post(f'{BASE}requests/{appt.id}/accept/')

    assert res.status_code == 200
    appt.refresh_from_db()
    assert appt.status == A.CONFIRMED
    assert client_for(doctor).get(BASE + 'requests/').json()['data'] == []


def test_rejecting_a_request_cancels_it_with_the_reason(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)

    client_for(doctor).post(f'{BASE}requests/{appt.id}/reject/', {'reason': 'On leave'}, format='json')

    appt.refresh_from_db()
    assert (appt.status, appt.cancellation_reason) == (A.CANCELLED, 'On leave')


def test_default_rejection_reason(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)

    client_for(doctor).post(f'{BASE}requests/{appt.id}/reject/')

    appt.refresh_from_db()
    assert appt.cancellation_reason == 'Rejected by doctor'


@pytest.mark.parametrize('action', ['accept', 'reject'])
def test_a_doctor_cannot_act_on_another_doctors_or_an_already_decided_request(patient, doctor, admin_user, action):
    pending = factories.appointment(patient, factories.service('a'), doctor, paid=True)
    confirmed = factories.appointment(patient, factories.service('b'), doctor, paid=True, days_ahead=2, status=A.CONFIRMED)

    assert client_for(admin_user).post(f'{BASE}requests/{pending.id}/{action}/').status_code == 404
    assert client_for(doctor).post(f'{BASE}requests/{confirmed.id}/{action}/').status_code == 404
    pending.refresh_from_db()
    assert pending.status == A.PENDING


def test_an_unpaid_checkout_cannot_be_accepted(patient, doctor):
    unpaid = factories.appointment(patient, factories.service(), doctor)

    assert client_for(doctor).post(f'{BASE}requests/{unpaid.id}/accept/').status_code in (400, 404, 409)


# ── Today's telehealth and the scratchpad ────────────────────────────────────

def test_todays_telehealth_lists_only_todays_video_visits(patient, other_patient, doctor):
    service = factories.service()
    video = Appointment.AppointmentType.TELEHEALTH
    today = factories.appointment(patient, service, doctor, paid=True, days_ahead=0, kind=video, status=A.CONFIRMED)
    factories.appointment(other_patient, service, doctor, paid=True, days_ahead=0)                      # physical
    factories.appointment(other_patient, service, doctor, paid=True, days_ahead=1, kind=video)          # tomorrow
    factories.appointment(other_patient, service, doctor, paid=True, days_ahead=0, kind=video,
                          time=datetime.time(15, 0), status=A.CANCELLED)

    rows = client_for(doctor).get(BASE + 'telehealth/').json()['data']

    assert [row['id'] for row in rows] == [str(today.id)]
    assert rows[0]['meeting_link'].startswith('/dashboard/telehealth/')


def test_scratchpad_returns_the_latest_note_and_is_private(doctor, admin_user):
    client = client_for(doctor)
    assert client.get(BASE + 'scratchpad/').json()['data']['content'] == ''

    client.post(BASE + 'scratchpad/', {'content': 'Call lab'}, format='json')
    saved = client.post(BASE + 'scratchpad/', {'content': 'Call lab at 3pm'}, format='json')

    assert saved.status_code == 201
    assert client.get(BASE + 'scratchpad/').json()['data']['content'] == 'Call lab at 3pm'
    assert client_for(admin_user).get(BASE + 'scratchpad/').json()['data']['content'] == ''


def test_scratchpad_notes_older_than_thirty_days_are_not_shown(doctor):
    note = DoctorNote.objects.create(doctor=doctor, content='Stale')
    DoctorNote.objects.filter(pk=note.pk).update(updated_at=timezone.now() - datetime.timedelta(days=31))

    assert client_for(doctor).get(BASE + 'scratchpad/').json()['data']['content'] == ''
