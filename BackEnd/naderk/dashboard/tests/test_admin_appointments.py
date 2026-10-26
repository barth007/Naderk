"""The front desk: incoming requests, the calendar, today's arrivals and scheduling."""
import datetime

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.core.models import User
from naderk.telehealth.models import TelehealthSession
from naderk.users.models import DoctorProfile, RolePermissionConfig
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

BASE = '/api/v1/dashboard/admin/'
A = Appointment.Status
GUARDED = ['appointments/requests/', 'appointments/calendar/', 'appointments/today/', 'doctors/', 'patients/']


@pytest.fixture
def agent():
    return make_user('agent@naderk.test', role=User.Role.AGENT)


@pytest.mark.parametrize('path', GUARDED)
def test_the_appointments_area_guards_these_endpoints(api_client, patient, doctor, agent, path):
    ops = make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER)      # store staff, not front desk

    assert api_client.get(BASE + path).status_code == 401
    for user in (patient, doctor, ops):
        assert client_for(user).get(BASE + path).status_code == 403
    assert client_for(agent).get(BASE + path).status_code == 200


def test_taking_the_area_away_from_a_role_locks_it_out(agent):
    RolePermissionConfig.objects.create(role='AGENT', permissions=['messaging'])

    assert client_for(agent).get(BASE + 'appointments/requests/').status_code == 403


def test_requests_lists_paid_pending_bookings_with_a_readable_preference(patient, other_patient, doctor, agent):
    service = factories.service()
    waiting = factories.appointment(patient, service, doctor, paid=True, time=datetime.time(9, 0))
    factories.appointment(other_patient, service, doctor, days_ahead=2)                              # unpaid checkout
    factories.appointment(other_patient, service, doctor, days_ahead=3, paid=True, status=A.CONFIRMED)

    rows = client_for(agent).get(BASE + 'appointments/requests/').json()['data']

    assert [row['id'] for row in rows] == [str(waiting.id)]
    assert rows[0]['preference'].endswith('Morning Preference')
    assert rows[0]['doctor_name'] == 'Dr. Test'


def test_calendar_shows_everything_but_cancelled(patient, doctor, agent):
    service = factories.service()
    kept = factories.appointment(patient, service, doctor, paid=True, status=A.CONFIRMED)
    factories.appointment(patient, service, doctor, paid=True, days_ahead=2, status=A.CANCELLED)

    rows = client_for(agent).get(BASE + 'appointments/calendar/').json()['data']

    assert [row['id'] for row in rows] == [str(kept.id)]


def test_todays_arrivals_are_confirmed_visits_in_time_order(patient, other_patient, doctor, agent):
    scan = factories.service('scan', requires_doctor=False)
    consult = factories.service('consult')
    late = factories.appointment(patient, consult, doctor, paid=True, days_ahead=0, time=datetime.time(15, 0),
                                 status=A.CONFIRMED)
    early = factories.appointment(other_patient, scan, None, paid=True, days_ahead=0, time=datetime.time(9, 0),
                                  status=A.CHECKED_IN)
    factories.appointment(patient, scan, None, paid=True, days_ahead=0, time=datetime.time(11, 0))    # still pending
    factories.appointment(patient, consult, doctor, paid=True, days_ahead=1, status=A.CONFIRMED)       # tomorrow

    rows = client_for(agent).get(BASE + 'appointments/today/').json()['data']

    assert [row['id'] for row in rows] == [str(early.id), str(late.id)]
    assert (rows[0]['is_onsite'], rows[0]['doctor_name'], rows[0]['appointment_time']) == (True, None, '09:00')
    assert (rows[1]['is_onsite'], rows[1]['doctor_name']) == (False, 'Dr. Test')


def test_doctor_picker_lists_doctors_who_are_taking_patients(doctor, agent):
    away = make_user('away@naderk.test', role=User.Role.DOCTOR, last_name='Away')
    DoctorProfile.objects.filter(user=away).update(is_accepting_patients=False)

    rows = client_for(agent).get(BASE + 'doctors/').json()['data']

    assert [row['id'] for row in rows] == [str(doctor.id)]
    assert rows[0]['specialization'] == 'Ophthalmologist'


# ── Scheduling ───────────────────────────────────────────────────────────────

def schedule(user, appt, doctor, date=None, time='14:00'):
    date = date or (timezone.localdate() + datetime.timedelta(days=4)).isoformat()
    body = {'doctor_id': str(doctor.id), 'date': date, 'time': time}
    return client_for(user).post(f'{BASE}appointments/{appt.id}/schedule/', body, format='json')


def test_scheduling_assigns_the_doctor_moves_the_slot_and_confirms(patient, doctor, agent):
    appt = factories.appointment(patient, factories.service(), None, paid=True)
    new_date = timezone.localdate() + datetime.timedelta(days=4)

    res = schedule(agent, appt, doctor)

    assert res.status_code == 200, res.content
    appt.refresh_from_db()
    assert (appt.doctor, appt.status, appt.appointment_date, appt.appointment_time) == (
        doctor, A.CONFIRMED, new_date, datetime.time(14, 0))


def test_scheduling_a_video_visit_creates_its_session_at_the_new_time(patient, doctor, agent):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True,
                                 kind=Appointment.AppointmentType.TELEHEALTH)

    assert schedule(agent, appt, doctor).status_code == 200

    session = TelehealthSession.objects.get(appointment=appt)
    assert timezone.localtime(session.scheduled_start).time() == datetime.time(14, 0)


@pytest.mark.parametrize('date, time', [('next tuesday', '14:00'), ('2030-02-30', '14:00'), ('2030-02-01', 'afternoon')])
def test_an_unreadable_date_or_time_is_a_validation_error(patient, doctor, agent, date, time):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)

    assert schedule(agent, appt, doctor, date=date, time=time).status_code == 400
    appt.refresh_from_db()
    assert appt.status == A.PENDING


def test_scheduling_refusals(patient, doctor, agent):
    pending = factories.appointment(patient, factories.service('a'), doctor, paid=True)
    confirmed = factories.appointment(patient, factories.service('b'), doctor, paid=True, days_ahead=2, status=A.CONFIRMED)
    client = client_for(agent)

    assert client.post(f'{BASE}appointments/{pending.id}/schedule/', {'doctor_id': str(doctor.id)}, format='json').status_code == 400
    assert schedule(agent, pending, patient).status_code == 404            # not a doctor
    assert schedule(agent, confirmed, doctor).status_code == 404           # already decided
    assert schedule(patient, pending, doctor).status_code == 403
    pending.refresh_from_db()
    assert pending.status == A.PENDING


def test_an_unpaid_checkout_cannot_be_scheduled(patient, doctor, agent):
    unpaid = factories.appointment(patient, factories.service(), doctor)

    assert schedule(agent, unpaid, doctor).status_code in (400, 404, 409)


def test_a_doctor_cannot_be_double_booked_by_scheduling(patient, other_patient, doctor, agent):
    service = factories.service()
    factories.appointment(other_patient, service, doctor, paid=True, days_ahead=4, time=datetime.time(14, 0),
                          status=A.CONFIRMED)
    appt = factories.appointment(patient, service, None, paid=True)

    assert schedule(agent, appt, doctor).status_code == 409


# ── Patient lookup ───────────────────────────────────────────────────────────

def test_patient_lookup_finds_by_name_email_phone_or_patient_id(agent):
    ada = make_user('ada@naderk.test', first_name='Ada', last_name='Lovelace', phone_number='+2348012345678')
    make_user('grace@naderk.test', first_name='Grace', last_name='Hopper')

    def found(q):
        return [row['email'] for row in client_for(agent).get(BASE + 'patients/', {'q': q}).json()['data']]

    assert found('lovel') == ['ada@naderk.test']
    assert found('GRACE@') == ['grace@naderk.test']
    assert found('8012345') == ['ada@naderk.test']
    assert found(ada.patient_profile.patient_id) == ['ada@naderk.test']
    assert found('nobody') == []
    assert len(found('')) == 2


def test_patient_lookup_never_returns_staff_or_deactivated_accounts(doctor, agent):
    make_user('gone@naderk.test', is_active=False)

    assert client_for(agent).get(BASE + 'patients/').json()['data'] == []
