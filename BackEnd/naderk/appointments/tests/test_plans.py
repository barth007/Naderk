"""What a patient has already paid for: session packs and monthly plans."""
import datetime
from decimal import Decimal

import pytest
from django.utils import timezone

from naderk.appointments.models import Appointment, MedicalService, PatientServicePlan
from naderk.appointments.services import ConsultationService
from naderk.appointments.tests import factories

pytestmark = pytest.mark.django_db

PACK = MedicalService.BillingType.SESSION_PACK
MONTHLY = MedicalService.BillingType.MONTHLY


def fee(patient, service):
    return ConsultationService.calculate_fee(patient, service)


def test_booked_sessions_count_against_the_pack(patient, doctor):
    pack = factories.service('pack', fee='150000.00', billing=PACK, sessions=2)
    # The paid booking that bought the pack uses the first session.
    factories.appointment(patient, pack, doctor, paid=True)
    ConsultationService.create_service_plan(patient, pack, 'PAY-1')

    assert fee(patient, pack) == Decimal('0.00')          # one session left
    factories.appointment(patient, pack, doctor, days_ahead=2, fee='0.00')

    assert fee(patient, pack) == Decimal('150000.00')     # both sessions now spoken for


def test_cancelled_booking_frees_its_session(patient, doctor):
    pack = factories.service('pack', fee='150000.00', billing=PACK, sessions=1)
    booked = factories.appointment(patient, pack, doctor, paid=True)
    ConsultationService.create_service_plan(patient, pack, 'PAY-1')
    assert fee(patient, pack) == Decimal('150000.00')

    booked.status = Appointment.Status.CANCELLED
    booked.save()

    assert fee(patient, pack) == Decimal('0.00')


def test_abandoned_checkout_does_not_use_a_session(patient, doctor):
    pack = factories.service('pack', fee='150000.00', billing=PACK, sessions=1)
    ConsultationService.create_service_plan(patient, pack, 'PAY-1')
    factories.appointment(patient, pack, doctor)          # unpaid, fee > 0: never completed checkout

    assert fee(patient, pack) == Decimal('0.00')


def test_completed_session_is_counted_once(patient, doctor):
    pack = factories.service('pack', fee='150000.00', billing=PACK, sessions=2)
    first = factories.appointment(patient, pack, doctor, paid=True)
    ConsultationService.create_service_plan(patient, pack, 'PAY-1')

    first.status = Appointment.Status.COMPLETED
    first.save()
    ConsultationService.consume_session(patient, pack)

    assert fee(patient, pack) == Decimal('0.00')          # one used, one left
    assert PatientServicePlan.objects.get().sessions_used == 1


def test_a_spent_pack_is_skipped_for_the_one_with_sessions_left(patient):
    pack = factories.service('pack', fee='150000.00', billing=PACK, sessions=1)
    spent = ConsultationService.create_service_plan(patient, pack, 'PAY-OLD')
    ConsultationService.consume_session(patient, pack)
    fresh = ConsultationService.create_service_plan(patient, pack, 'PAY-NEW')

    ConsultationService.consume_session(patient, pack)

    spent.refresh_from_db()
    fresh.refresh_from_db()
    assert (spent.sessions_used, fresh.sessions_used) == (1, 1)
    assert fee(patient, pack) == Decimal('150000.00')


def test_expired_monthly_plan_does_not_hide_the_current_one(patient):
    monthly = factories.service('monthly', fee='20000.00', billing=MONTHLY)
    today = timezone.localdate()
    for reference, valid_until in [('PAY-NOW', today + datetime.timedelta(days=5)),
                                   ('PAY-LAST-MONTH', today - datetime.timedelta(days=5))]:
        PatientServicePlan.objects.create(
            patient=patient, service=monthly, payment_reference=reference,
            valid_from=valid_until - datetime.timedelta(days=30), valid_until=valid_until,
        )

    assert fee(patient, monthly) == Decimal('0.00')


def test_expired_monthly_plan_alone_is_chargeable(patient):
    monthly = factories.service('monthly', fee='20000.00', billing=MONTHLY)
    today = timezone.localdate()
    PatientServicePlan.objects.create(
        patient=patient, service=monthly, payment_reference='PAY-OLD',
        valid_from=today - datetime.timedelta(days=40), valid_until=today - datetime.timedelta(days=5),
    )

    assert fee(patient, monthly) == Decimal('20000.00')
