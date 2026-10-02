"""Rescheduling checks the patient's own diary, and not against the appointment being moved."""
import datetime

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

CONFIRMED = Appointment.Status.CONFIRMED


def reschedule(user, appt, *, days_ahead, time):
    date = timezone.localdate() + datetime.timedelta(days=days_ahead)
    return client_for(user).post(
        f'/api/v1/appointments/{appt.id}/reschedule/',
        {'date': date.isoformat(), 'time': time}, format='json',
    )


def test_moving_an_appointment_a_few_minutes_does_not_clash_with_itself(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, status=CONFIRMED, paid=True,
                                 time=datetime.time(10, 0))

    res = reschedule(patient, appt, days_ahead=1, time='10:15')

    assert res.status_code == 200, res.content
    appt.refresh_from_db()
    assert appt.appointment_time == datetime.time(10, 15)


def test_staff_reschedule_is_checked_against_the_patients_diary(patient, doctor, admin_user):
    service = factories.service()
    appt = factories.appointment(patient, service, doctor, status=CONFIRMED, paid=True)
    # The patient is already busy at 14:00 the day after.
    factories.appointment(patient, factories.service('other'), doctor, status=CONFIRMED, paid=True,
                          days_ahead=2, time=datetime.time(14, 0))

    res = reschedule(admin_user, appt, days_ahead=2, time='14:10')

    assert res.status_code == 409, res.content


def test_staff_members_own_bookings_do_not_block_a_patients_reschedule(patient, doctor, admin_user):
    appt = factories.appointment(patient, factories.service(), doctor, status=CONFIRMED, paid=True)
    # The admin happens to have an appointment of their own at that time.
    factories.appointment(admin_user, factories.service('other'), None, status=CONFIRMED, paid=True,
                          days_ahead=2, time=datetime.time(14, 0))

    res = reschedule(admin_user, appt, days_ahead=2, time='14:00')

    assert res.status_code == 200, res.content


def test_patient_still_cannot_double_book_themselves(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, status=CONFIRMED, paid=True)
    factories.appointment(patient, factories.service('other'), doctor, status=CONFIRMED, paid=True,
                          days_ahead=2, time=datetime.time(14, 0))

    assert reschedule(patient, appt, days_ahead=2, time='14:00').status_code == 409
