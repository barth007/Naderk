"""Which times a patient is offered, and holding one while they check out."""
import datetime

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment, AppointmentSlotReservation, DoctorAvailability
from naderk.appointments.services import AppointmentSlotService
from naderk.appointments.tests import factories
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

SLOTS = '/api/v1/appointments/available-slots/'
RESERVE = '/api/v1/appointments/reserve-slot/'


def day(ahead=3):
    return timezone.localdate() + datetime.timedelta(days=ahead)


def works(doctor, date, start=(9, 0), end=(11, 0), slot=30):
    return DoctorAvailability.objects.create(
        doctor=doctor, weekday=date.weekday(), start_time=datetime.time(*start),
        end_time=datetime.time(*end), slot_duration=slot,
    )


def slots_for(doctor, date):
    return AppointmentSlotService.generate_available_slots(doctor, date)


# ── Doctor slots ─────────────────────────────────────────────────────────────

def test_slots_follow_the_doctors_hours(doctor):
    works(doctor, day())

    assert slots_for(doctor, day()) == ['09:00', '09:30', '10:00', '10:30']


def test_no_availability_that_weekday_means_no_slots(doctor):
    works(doctor, day())

    assert slots_for(doctor, day() + datetime.timedelta(days=1)) == []


def test_inactive_availability_is_ignored(doctor):
    DoctorAvailability.objects.filter(pk=works(doctor, day()).pk).update(is_active=False)

    assert slots_for(doctor, day()) == []


def test_a_slot_that_does_not_fit_before_closing_is_not_offered(doctor):
    works(doctor, day(), end=(10, 45), slot=30)

    assert slots_for(doctor, day()) == ['09:00', '09:30', '10:00']


def test_split_shifts_are_merged_in_order(doctor):
    works(doctor, day(), start=(14, 0), end=(15, 0))
    works(doctor, day(), start=(9, 0), end=(10, 0))

    assert slots_for(doctor, day()) == ['09:00', '09:30', '14:00', '14:30']


@pytest.mark.parametrize('status, taken', [
    (Appointment.Status.PENDING, True), (Appointment.Status.CONFIRMED, True),
    (Appointment.Status.CANCELLED, False), (Appointment.Status.NO_SHOW, False),
])
def test_booked_times_are_removed_and_freed_times_return(patient, doctor, status, taken):
    works(doctor, day())
    factories.appointment(patient, factories.service(), doctor, days_ahead=3,
                          time=datetime.time(9, 30), status=status)

    assert ('09:30' not in slots_for(doctor, day())) is taken


def test_a_held_slot_is_removed_until_the_hold_expires(patient, doctor):
    works(doctor, day())
    hold = AppointmentSlotReservation.objects.create(
        patient=patient, doctor=doctor,
        slot_datetime=timezone.make_aware(datetime.datetime.combine(day(), datetime.time(10, 0))),
        expires_at=timezone.now() + datetime.timedelta(minutes=10),
    )
    assert '10:00' not in slots_for(doctor, day())

    AppointmentSlotReservation.objects.filter(pk=hold.pk).update(expires_at=timezone.now() - datetime.timedelta(seconds=1))

    assert '10:00' in slots_for(doctor, day())


def test_today_only_offers_times_at_least_half_an_hour_away(doctor):
    today = timezone.localdate()
    DoctorAvailability.objects.create(doctor=doctor, weekday=today.weekday(),
                                      start_time=datetime.time(0, 0), end_time=datetime.time(23, 59))
    earliest = timezone.localtime() + datetime.timedelta(minutes=30)

    for slot in slots_for(doctor, today):
        offered = timezone.make_aware(datetime.datetime.combine(today, datetime.time.fromisoformat(slot)))
        assert offered >= earliest - datetime.timedelta(seconds=5)


# ── Facility slots ───────────────────────────────────────────────────────────

def test_facility_slots_run_through_opening_hours_at_the_service_length():
    scan = factories.service('scan', requires_doctor=False, minutes=60)

    slots = AppointmentSlotService.generate_facility_slots(scan, day())

    assert slots == [f'{hour:02d}:00' for hour in range(8, 17)]


def test_short_facility_services_step_by_at_least_fifteen_minutes():
    quick = factories.service('pressure-check', requires_doctor=False, minutes=5)

    slots = AppointmentSlotService.generate_facility_slots(quick, day())

    assert slots[:3] == ['08:00', '08:15', '08:30']


# ── Endpoint ─────────────────────────────────────────────────────────────────

def test_slots_can_be_browsed_without_signing_in(api_client, doctor):
    works(doctor, day())

    res = api_client.get(SLOTS, {'doctor_id': str(doctor.id), 'date': day().isoformat()})

    assert res.status_code == 200
    assert res.json()['data']['slots'] == ['09:00', '09:30', '10:00', '10:30']


def test_facility_slots_by_service(api_client):
    scan = factories.service('scan', requires_doctor=False, minutes=60)

    res = api_client.get(SLOTS, {'service_id': str(scan.id), 'date': day().isoformat()})

    assert len(res.json()['data']['slots']) == 9


def test_slot_endpoint_refusals(api_client, patient):
    missing = '00000000-0000-0000-0000-000000000000'

    assert api_client.get(SLOTS, {'date': day().isoformat()}).status_code == 400
    assert api_client.get(SLOTS, {'doctor_id': missing}).status_code == 400
    assert api_client.get(SLOTS, {'doctor_id': missing, 'date': day().isoformat()}).status_code == 404
    assert api_client.get(SLOTS, {'service_id': missing, 'date': day().isoformat()}).status_code == 404
    # A patient's id is not a doctor's.
    assert api_client.get(SLOTS, {'doctor_id': str(patient.id), 'date': day().isoformat()}).status_code == 404


# ── Holding a slot ───────────────────────────────────────────────────────────

def reserve(user, doctor, time='09:30', date=None):
    body = {'doctor_id': str(doctor.id), 'date': (date or day()).isoformat(), 'time': time}
    return client_for(user).post(RESERVE, body, format='json')


def test_reserving_holds_the_slot_for_ten_minutes(patient, doctor):
    res = reserve(patient, doctor)

    assert res.status_code == 200, res.content
    hold = AppointmentSlotReservation.objects.get()
    remaining = (hold.expires_at - timezone.now()).total_seconds()
    assert 9 * 60 < remaining <= 10 * 60
    assert res.json()['data']['reservation_id'] == str(hold.id)


def test_a_second_patient_cannot_take_a_held_slot(patient, other_patient, doctor):
    reserve(patient, doctor)

    assert reserve(other_patient, doctor).status_code == 409
    assert reserve(other_patient, doctor, time='10:00').status_code == 200


def test_reserving_again_extends_the_same_hold(patient, doctor):
    reserve(patient, doctor)
    reserve(patient, doctor)

    assert AppointmentSlotReservation.objects.count() == 1


def test_a_booked_or_past_slot_cannot_be_reserved(patient, other_patient, doctor):
    factories.appointment(other_patient, factories.service(), doctor, days_ahead=3,
                          time=datetime.time(9, 30), status=Appointment.Status.CONFIRMED)

    assert reserve(patient, doctor).status_code == 409
    assert reserve(patient, doctor, date=timezone.localdate() - datetime.timedelta(days=1)).status_code == 400


def test_reserving_needs_sign_in_and_a_real_doctor(api_client, patient, doctor):
    body = {'doctor_id': '00000000-0000-0000-0000-000000000000', 'date': day().isoformat(), 'time': '09:30'}

    assert api_client.post(RESERVE, body, format='json').status_code == 401
    assert client_for(patient).post(RESERVE, body, format='json').status_code == 404
    assert client_for(patient).post(RESERVE, {'doctor_id': str(doctor.id)}, format='json').status_code == 400
