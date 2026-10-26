import datetime
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService, Appointment
from naderk.payments.models import PaymentTransaction


class _FakeProvider:
    def __init__(self, valid=True):
        self._valid = valid
    def verify_webhook(self, *, payload, signature):
        return self._valid
    def parse_webhook(self, payload):
        return {'event_type': payload.get('event', ''),
                'reference': (payload.get('data') or {}).get('reference', '')}


class PaymentLifecycleTests(TestCase):
    """confirm_and_fulfill (verify → currency/amount → confirm/fulfill) + webhook events."""

    def setUp(self):
        self.client = APIClient()
        self.patient = User.objects.create_user(email='lp@x.com', password='pw12345!')
        self.doctor = User.objects.create_user(email='ld@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.service = MedicalService.objects.create(
            name='Life Consult', slug='life-gp', requires_doctor=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500)
        self.appt = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=timezone.now().date() + datetime.timedelta(days=1),
            appointment_time=datetime.time(11, 0), status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PENDING, consultation_fee=8500)
        self.txn = PaymentTransaction.objects.create(
            user=self.patient, provider='PAYSTACK', reference='NDK-LIFE1',
            amount_kobo=850000, currency='NGN', appointment=self.appt,
            status=PaymentTransaction.Status.INITIATED, raw_response={})

    def _result(self, status='success', amount_kobo=850000, currency='NGN'):
        return type('R', (), {'status': status, 'metadata': {}, 'amount_kobo': amount_kobo,
                              'currency': currency, 'provider_txn_ref': 'MNFY|1'})()

    def test_amount_mismatch_does_not_fulfill(self):
        from naderk.payments.services import confirm_and_fulfill
        with patch('naderk.payments.services.verify_and_confirm', return_value=self._result(amount_kobo=800000)):
            confirm_and_fulfill(reference='NDK-LIFE1')
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_currency_mismatch_does_not_fulfill(self):
        from naderk.payments.services import confirm_and_fulfill
        with patch('naderk.payments.services.verify_and_confirm', return_value=self._result(currency='USD')):
            confirm_and_fulfill(reference='NDK-LIFE1')
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_exact_amount_confirms_and_persists_provider_txn_ref(self):
        from naderk.payments.services import confirm_and_fulfill
        # real verify_and_confirm persists provider_txn_ref; here we mock verify only
        with patch('naderk.payments.services.verify_and_confirm', return_value=self._result()):
            confirm_and_fulfill(reference='NDK-LIFE1')
        self.appt.refresh_from_db()
        self.txn.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PAID)
        self.assertEqual(self.txn.status, PaymentTransaction.Status.SUCCESS)

    def test_record_webhook_event_dedupes(self):
        from naderk.payments.services import record_webhook_event
        from naderk.payments.models import PaymentWebhookEvent
        body = b'{"event":"charge.success","data":{"reference":"NDK-LIFE1"}}'
        with patch('naderk.payments.tasks.process_payment_webhook.delay') as delay:
            first = record_webhook_event(provider_name='PAYSTACK', raw_body=body, signature_valid=True)
            second = record_webhook_event(provider_name='PAYSTACK', raw_body=body, signature_valid=True)
        self.assertIsNotNone(first)
        self.assertIsNone(second)  # duplicate delivery ignored
        self.assertEqual(PaymentWebhookEvent.objects.filter(provider='PAYSTACK').count(), 1)
        delay.assert_called_once()

    def test_process_payment_webhook_confirms(self):
        from naderk.payments.models import PaymentWebhookEvent
        from naderk.payments.tasks import process_payment_webhook
        ev = PaymentWebhookEvent.objects.create(
            provider='PAYSTACK', event_type='charge.success', event_hash='hash1',
            payment_reference='NDK-LIFE1', payload={}, signature_valid=True)
        with patch('naderk.payments.services.verify_and_confirm', return_value=self._result()):
            process_payment_webhook(str(ev.id))
        ev.refresh_from_db()
        self.appt.refresh_from_db()
        self.assertEqual(ev.processing_status, PaymentWebhookEvent.ProcessingStatus.PROCESSED)
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PAID)

    def test_webhook_endpoint_rejects_bad_signature(self):
        from naderk.payments.models import PaymentWebhookEvent
        body = {'event': 'charge.success', 'data': {'reference': 'NDK-LIFE1'}}
        with patch('naderk.payments.apis.get_provider', return_value=_FakeProvider(valid=False)):
            res = self.client.post(reverse('webhook-paystack'), body, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(PaymentWebhookEvent.objects.count(), 0)

    def test_webhook_endpoint_records_on_valid_signature(self):
        from naderk.payments.models import PaymentWebhookEvent
        body = {'event': 'charge.success', 'data': {'reference': 'NDK-LIFE1'}}
        with patch('naderk.payments.apis.get_provider', return_value=_FakeProvider(valid=True)), \
             patch('naderk.payments.tasks.process_payment_webhook.delay') as delay:
            res = self.client.post(reverse('webhook-paystack'), body, format='json')
        self.assertEqual(res.status_code, 200)
        ev = PaymentWebhookEvent.objects.get(provider='PAYSTACK')
        self.assertEqual(ev.payment_reference, 'NDK-LIFE1')
        delay.assert_called_once()
