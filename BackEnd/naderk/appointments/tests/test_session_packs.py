from decimal import Decimal
from django.test import TestCase
from naderk.core.models import User
from naderk.appointments.models import MedicalService


class SessionPackConsumptionTests(TestCase):
    """
    consume_session existed but was called from nowhere, so a SESSION_PACK plan
    stayed at sessions_used=0 forever. has_active_plan therefore kept returning
    True and every booking after the first was priced at zero — a paid service
    became permanently free.
    """

    def setUp(self):
        from django.contrib.auth import get_user_model
        from naderk.appointments.models import MedicalService
        User = get_user_model()
        self.patient = User.objects.create_user(
            email='packpatient@x.com', password='pw12345!', role='PATIENT'
        )
        self.service = MedicalService.objects.create(
            name='Glaucoma Pack', slug='glaucoma-pack', description='x',
            fee=Decimal('150000.00'),
            billing_type=MedicalService.BillingType.SESSION_PACK,
            sessions_included=2, requires_doctor=True, duration_minutes=30,
        )

    def test_pack_depletes_and_price_returns(self):
        from naderk.appointments.services import ConsultationService

        self.assertEqual(
            ConsultationService.calculate_fee(self.patient, self.service),
            Decimal('150000.00'),
        )

        ConsultationService.create_service_plan(
            patient=self.patient, service=self.service, payment_reference='PAY-1'
        )
        # Paid for 2 sessions — both are free.
        self.assertEqual(ConsultationService.calculate_fee(self.patient, self.service), Decimal('0.00'))

        ConsultationService.consume_session(self.patient, self.service)
        self.assertEqual(ConsultationService.calculate_fee(self.patient, self.service), Decimal('0.00'))

        ConsultationService.consume_session(self.patient, self.service)
        # Pack exhausted — the service is chargeable again.
        self.assertEqual(
            ConsultationService.calculate_fee(self.patient, self.service),
            Decimal('150000.00'),
        )

    def test_per_visit_is_never_free(self):
        from naderk.appointments.models import MedicalService
        from naderk.appointments.services import ConsultationService

        service = MedicalService.objects.create(
            name='Retina Consult', slug='retina-consult', description='x',
            fee=Decimal('150000.00'),
            billing_type=MedicalService.BillingType.PER_VISIT,
            requires_doctor=True, duration_minutes=30,
        )
        ConsultationService.create_service_plan(
            patient=self.patient, service=service, payment_reference='PAY-2'
        )
        self.assertEqual(
            ConsultationService.calculate_fee(self.patient, service),
            Decimal('150000.00'),
        )
