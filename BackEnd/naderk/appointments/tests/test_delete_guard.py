"""DELETE /appointments/<id>/ only clears an unfinished checkout, never a paid booking."""
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.payments.models import PaymentTransaction
from naderk.payments.services import confirm_and_fulfill
from tests.helpers import client_for

pytestmark = pytest.mark.django_db


def delete(user, appt):
    return client_for(user).delete(f'/api/v1/appointments/{appt.id}/')


def provider_says(status, amount_kobo=850_000):
    return patch(
        'naderk.payments.services.verify_and_confirm',
        return_value=SimpleNamespace(status=status, amount_kobo=amount_kobo, currency='NGN',
                                     metadata={}, provider_txn_ref=''),
    )


def transaction(appt, status=PaymentTransaction.Status.INITIATED):
    return PaymentTransaction.objects.create(
        user=appt.patient, provider='PAYSTACK', reference='NDK-DEL1', amount_kobo=850_000,
        appointment=appt, status=status, raw_response={},
    )


def test_unpaid_checkout_can_be_deleted(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor)

    assert delete(patient, appt).status_code == 200
    assert not Appointment.objects.filter(id=appt.id).exists()


def test_paid_appointment_cannot_be_deleted(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor, paid=True)

    res = delete(patient, appt)

    assert res.status_code == 409, res.content
    assert Appointment.objects.filter(id=appt.id).exists()


@pytest.mark.parametrize('status', [
    Appointment.Status.CONFIRMED, Appointment.Status.COMPLETED, Appointment.Status.NO_SHOW,
])
def test_appointment_past_checkout_cannot_be_deleted(patient, doctor, status):
    appt = factories.appointment(patient, factories.service(fee='0.00'), doctor, status=status)

    assert delete(patient, appt).status_code == 409
    assert Appointment.objects.filter(id=appt.id).exists()


def test_payment_that_landed_but_was_not_confirmed_yet_blocks_the_delete(patient, doctor):
    """The popup closed, the bank transfer went through, our confirmation is still on its way."""
    appt = factories.appointment(patient, factories.service(), doctor)
    transaction(appt)

    with provider_says('success'):
        res = delete(patient, appt)

    assert res.status_code == 409, res.content
    appt.refresh_from_db()
    assert appt.payment_status == Appointment.PaymentStatus.PAID


def test_checkout_with_an_abandoned_payment_is_cancelled_and_frees_the_slot(patient, doctor):
    """Kept, not deleted: a slow transfer may still arrive and needs a booking to land on."""
    appt = factories.appointment(patient, factories.service(), doctor)
    transaction(appt)

    with provider_says('abandoned', amount_kobo=0):
        res = delete(patient, appt)

    assert res.status_code == 200, res.content
    appt.refresh_from_db()
    assert appt.status == Appointment.Status.CANCELLED
    assert appt.payment_status == Appointment.PaymentStatus.PENDING


def test_late_payment_brings_an_abandoned_checkout_back(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor)
    txn = transaction(appt)
    with provider_says('abandoned', amount_kobo=0):
        delete(patient, appt)

    with provider_says('success'):
        confirm_and_fulfill(reference=txn.reference)

    appt.refresh_from_db()
    assert appt.payment_status == Appointment.PaymentStatus.PAID
    assert appt.status == Appointment.Status.PENDING      # back in the doctor's queue
    assert appt.cancelled_at is None


def test_late_payment_after_the_slot_was_rebooked_is_flagged_not_double_booked(
        patient, other_patient, doctor):
    service = factories.service()
    appt = factories.appointment(patient, service, doctor)
    txn = transaction(appt)
    with provider_says('abandoned', amount_kobo=0):
        delete(patient, appt)
    factories.appointment(other_patient, service, doctor, paid=True)   # same doctor, date, time

    with provider_says('success'):
        confirm_and_fulfill(reference=txn.reference)

    appt.refresh_from_db()
    assert appt.payment_status == Appointment.PaymentStatus.PAID
    assert appt.status == Appointment.Status.CANCELLED
    assert appt.audit_logs.filter(reason__contains='refund').exists()


def test_a_cancellation_the_patient_asked_for_is_not_undone_by_a_payment(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor)
    txn = transaction(appt)
    appt.status = Appointment.Status.CANCELLED
    appt.cancellation_reason = 'Changed my mind'
    appt.save()

    with provider_says('success'):
        confirm_and_fulfill(reference=txn.reference)

    appt.refresh_from_db()
    assert appt.status == Appointment.Status.CANCELLED


def test_unreachable_provider_keeps_the_appointment(patient, doctor):
    """If we cannot tell whether it was paid, do not destroy it; the sweeper will."""
    appt = factories.appointment(patient, factories.service(), doctor)
    transaction(appt)

    with patch('naderk.payments.services.verify_and_confirm', side_effect=RuntimeError('down')):
        res = delete(patient, appt)

    assert res.status_code == 409, res.content
    assert Appointment.objects.filter(id=appt.id).exists()


def test_cannot_delete_someone_elses_appointment(patient, other_patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor)

    assert delete(other_patient, appt).status_code == 404
