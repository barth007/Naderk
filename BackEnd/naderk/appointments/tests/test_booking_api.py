"""Creating, listing, cancelling and running an appointment through the API."""
import datetime
from decimal import Decimal

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment, AppointmentSlotReservation
from naderk.appointments.services import ConsultationService
from naderk.appointments.tests import factories
from naderk.core.models import User
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

BASE = '/api/v1/appointments/'
A = Appointment.Status


def day(ahead=3):
    return timezone.localdate() + datetime.timedelta(days=ahead)


def book(user, service, doctor=None, time='10:00', days_ahead=3, **extra):
    body = {'service_id': str(service.id), 'date': day(days_ahead).isoformat(), 'time': time,
            'appointment_type': 'PHYSICAL'}
    if doctor is not None:
        body['doctor_id'] = str(doctor.id)
    body.update(extra)
    return client_for(user).post(BASE + 'create/', body, format='json')


# ── Creating ─────────────────────────────────────────────────────────────────

def test_booking_creates_an_unpaid_pending_appointment_at_the_service_fee(patient, doctor):
    res = book(patient, factories.service(fee='8500.00'), doctor, notes='First visit')

    assert res.status_code == 200, res.content
    appt = Appointment.objects.get()
    assert (appt.patient, appt.doctor, appt.status, appt.payment_status) == (patient, doctor, A.PENDING, 'PENDING')
    assert (appt.consultation_fee, appt.notes) == (Decimal('8500.00'), 'First visit')


def test_services_list_is_public_and_hides_inactive(api_client):
    factories.service('consult')
    retired = factories.service('retired')
    type(retired).objects.filter(pk=retired.pk).update(is_active=False)

    rows = api_client.get(BASE + 'services/').json()['data']['results']

    assert [row['slug'] for row in rows] == ['consult']


def test_booking_under_an_active_plan_is_free(patient, doctor):
    monthly = factories.service('monthly', fee='20000.00', billing='MONTHLY')
    ConsultationService.create_service_plan(patient, monthly, 'PAY-1')

    book(patient, monthly, doctor)

    assert Appointment.objects.get().consultation_fee == Decimal('0.00')


def test_the_patients_hold_is_converted_when_they_book(patient, doctor):
    client_for(patient).post(BASE + 'reserve-slot/', {
        'doctor_id': str(doctor.id), 'date': day().isoformat(), 'time': '10:00'}, format='json')

    book(patient, factories.service(), doctor)

    assert AppointmentSlotReservation.objects.get().status == 'BOOKED'


def test_a_slot_another_patient_holds_or_has_booked_is_refused(patient, other_patient, doctor):
    service = factories.service()
    client_for(other_patient).post(BASE + 'reserve-slot/', {
        'doctor_id': str(doctor.id), 'date': day().isoformat(), 'time': '10:00'}, format='json')
    assert book(patient, service, doctor).status_code == 409

    book(other_patient, service, doctor, time='11:00')
    assert book(patient, service, doctor, time='11:00').status_code == 409
    assert Appointment.objects.filter(patient=patient).count() == 0


def test_retrying_the_same_unpaid_booking_returns_the_same_appointment(patient, doctor):
    service = factories.service()

    first, second = book(patient, service, doctor), book(patient, service, doctor)

    assert first.json()['data']['id'] == second.json()['data']['id']
    assert Appointment.objects.count() == 1


def test_the_same_service_twice_in_a_day_is_a_duplicate(patient, doctor):
    service = factories.service()
    factories.appointment(patient, service, doctor, days_ahead=3, time=datetime.time(9, 0), paid=True)

    res = book(patient, service, doctor, time='15:00')

    assert res.status_code == 409
    assert 'duplicate' in res.json()['type']


def test_overlapping_another_of_the_patients_appointments_is_refused(patient, doctor):
    factories.appointment(patient, factories.service('long', minutes=60), doctor, days_ahead=3,
                          time=datetime.time(10, 0), paid=True)

    res = book(patient, factories.service('other'), doctor, time='10:30')

    assert res.status_code == 409
    assert 'overlapping' in res.json()['type']


def test_a_doctor_service_needs_a_doctor_and_a_facility_service_does_not(patient):
    assert book(patient, factories.service('consult')).status_code == 400

    res = book(patient, factories.service('scan', requires_doctor=False))

    assert res.status_code == 200, res.content
    assert Appointment.objects.get().doctor is None


@pytest.mark.parametrize('body', [
    {'service_id': '00000000-0000-0000-0000-000000000000'},
    {'doctor_id': '00000000-0000-0000-0000-000000000000'},
])
def test_unknown_service_or_doctor_is_404(patient, doctor, body):
    assert book(patient, factories.service(), doctor, **body).status_code == 404


def test_booking_validation_and_sign_in(api_client, patient, doctor):
    assert api_client.post(BASE + 'create/', {}, format='json').status_code == 401
    res = client_for(patient).post(BASE + 'create/', {'appointment_type': 'TELEPATHY'}, format='json')

    assert res.status_code == 400
    assert {'service_id', 'date', 'time', 'appointment_type'} <= set(res.json()['errors'])


# ── Booking for someone else ─────────────────────────────────────────────────

def test_a_support_agent_books_for_a_patient(patient, doctor):
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)

    res = book(agent, factories.service(), doctor, patient_id=str(patient.id))

    assert res.status_code == 200, res.content
    assert Appointment.objects.get().patient == patient


def test_a_patient_cannot_book_for_someone_else(patient, other_patient, doctor):
    res = book(patient, factories.service(), doctor, patient_id=str(other_patient.id))

    assert res.status_code == 403
    assert not Appointment.objects.exists()


def test_staff_can_only_book_for_real_patients(doctor, admin_user):
    service = factories.service()

    assert book(admin_user, service, doctor, patient_id='00000000-0000-0000-0000-000000000000').status_code == 404
    assert book(admin_user, service, doctor, patient_id=str(doctor.id)).status_code == 400


# ── History and detail ───────────────────────────────────────────────────────

def test_history_splits_upcoming_from_past_and_hides_unfinished_checkouts(patient, doctor):
    service = factories.service()
    paid = factories.appointment(patient, service, doctor, days_ahead=2, paid=True)
    factories.appointment(patient, service, doctor, days_ahead=4)                       # abandoned checkout
    done = factories.appointment(patient, service, doctor, days_ahead=-5, status=A.COMPLETED, paid=True)

    data = client_for(patient).get(BASE + 'history/').json()['data']

    assert [row['id'] for row in data['upcoming']] == [str(paid.id)]
    assert [row['id'] for row in data['past']] == [str(done.id)]


def test_history_is_per_patient_but_staff_can_look_one_up(patient, other_patient, doctor, admin_user):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)

    assert client_for(other_patient).get(BASE + 'history/').json()['data']['upcoming'] == []
    assert client_for(other_patient).get(BASE + 'history/', {'patient_id': str(patient.id)}).json()['data']['upcoming'] == []
    looked_up = client_for(admin_user).get(BASE + 'history/', {'patient_id': str(patient.id)}).json()['data']
    assert [row['id'] for row in looked_up['upcoming']] == [str(appt.id)]


def test_detail_is_only_for_the_patient(patient, other_patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)

    assert client_for(patient).get(f'{BASE}{appt.id}/').json()['data']['id'] == str(appt.id)
    assert client_for(other_patient).get(f'{BASE}{appt.id}/').status_code == 404


# ── Cancelling ───────────────────────────────────────────────────────────────

def cancel(user, appt, reason='Cannot make it'):
    return client_for(user).post(f'{BASE}{appt.id}/cancel/', {'reason': reason}, format='json')


def test_patient_cancels_and_the_slot_is_free_again(patient, other_patient, doctor):
    service = factories.service()
    appt_id = book(patient, service, doctor).json()['data']['id']
    appt = Appointment.objects.get(id=appt_id)

    res = cancel(patient, appt)

    assert res.status_code == 200
    appt.refresh_from_db()
    assert (appt.status, appt.cancellation_reason) == (A.CANCELLED, 'Cannot make it')
    assert appt.cancelled_at is not None
    assert book(other_patient, service, doctor).status_code == 200


@pytest.mark.parametrize('status', [A.CANCELLED, A.COMPLETED, A.NO_SHOW])
def test_a_finished_appointment_cannot_be_cancelled(patient, doctor, status):
    appt = factories.appointment(patient, factories.service(), doctor, status=status, paid=True)

    assert cancel(patient, appt).status_code == 400


def test_only_the_patient_or_staff_can_cancel(patient, other_patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)

    assert cancel(other_patient, appt).status_code == 404
    assert cancel(agent, appt).status_code == 200


# ── Running the visit ────────────────────────────────────────────────────────

def act(user, appt, action):
    return client_for(user).post(f'{BASE}{appt.id}/{action}/')


def test_doctor_starts_and_completes_a_confirmed_visit(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, status=A.CONFIRMED, paid=True)

    assert act(doctor, appt, 'start').status_code == 200
    appt.refresh_from_db()
    assert (appt.status, appt.started_at is not None) == (A.IN_PROGRESS, True)

    assert act(doctor, appt, 'complete').status_code == 200
    appt.refresh_from_db()
    assert (appt.status, appt.completed_at is not None) == (A.COMPLETED, True)


def test_an_unconfirmed_visit_cannot_be_started_or_completed(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)     # still PENDING

    assert act(doctor, appt, 'start').status_code == 400
    assert act(doctor, appt, 'complete').status_code == 400


def test_a_completed_visit_cannot_be_completed_again(patient, doctor):
    pack = factories.service('pack', billing='SESSION_PACK', sessions=3)
    appt = factories.appointment(patient, pack, doctor, status=A.CONFIRMED, paid=True)
    plan = ConsultationService.create_service_plan(patient, pack, 'PAY-1')
    act(doctor, appt, 'complete')

    assert act(doctor, appt, 'complete').status_code == 400
    plan.refresh_from_db()
    assert plan.sessions_used == 1          # not drawn down twice


def test_strangers_cannot_start_or_complete(patient, other_patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, status=A.CONFIRMED, paid=True)
    other_doctor = make_user('doctor2@naderk.test', role=User.Role.DOCTOR)

    for user in (other_patient, other_doctor):
        assert act(user, appt, 'start').status_code == 403
        assert act(user, appt, 'complete').status_code == 403
    appt.refresh_from_db()
    assert appt.status == A.CONFIRMED


def test_a_patient_cannot_start_or_complete_their_own_consultation(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, status=A.CONFIRMED, paid=True)

    assert act(patient, appt, 'start').status_code == 403
    assert act(patient, appt, 'complete').status_code == 403
    appt.refresh_from_db()
    assert appt.status == A.CONFIRMED


def test_front_desk_runs_a_facility_visit_that_has_no_doctor(patient):
    scan = factories.service('scan', requires_doctor=False)
    appt = factories.appointment(patient, scan, None, status=A.CHECKED_IN, paid=True)
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)

    assert act(agent, appt, 'start').status_code == 200
    assert act(agent, appt, 'complete').status_code == 200
    appt.refresh_from_db()
    assert appt.status == A.COMPLETED
