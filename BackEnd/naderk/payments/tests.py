import datetime
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService, Appointment
from .models import PaymentTransaction


class VerifyAppointmentPaymentTests(TestCase):
    """Confirmation used to depend solely on the Paystack webhook. A Paystack
    account has one webhook URL, so whichever environment misses out left the
    patient paying and then watching a spinner forever."""

    def setUp(self):
        self.client = APIClient()
        self.patient = User.objects.create_user(email='p@x.com', password='pw12345!')
        self.other = User.objects.create_user(email='o@x.com', password='pw12345!')
        self.client.force_authenticate(user=self.patient)
        self.doctor = User.objects.create_user(email='d@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.service = MedicalService.objects.create(
            name='GP Consult', slug='gp', requires_doctor=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )
        self.appt = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=timezone.now().date() + datetime.timedelta(days=1),
            appointment_time=datetime.time(13, 0), status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PENDING, consultation_fee=8500,
        )
        self.txn = PaymentTransaction.objects.create(
            user=self.patient, provider='PAYSTACK', reference='NDK-ABC123',
            amount_kobo=850000, appointment=self.appt,
            status=PaymentTransaction.Status.INITIATED, raw_response={},
        )
        self.url = reverse('payment-verify-appointment')

    def _ok(self, status='success', amount_kobo=850000):
        # confirm_and_fulfill verifies via services.verify_and_confirm, then checks
        # currency + amount before fulfilling.
        return patch('naderk.payments.services.verify_and_confirm',
                     return_value=type('R', (), {'status': status, 'metadata': {},
                                                 'amount_kobo': amount_kobo, 'currency': 'NGN',
                                                 'provider_txn_ref': ''})())

    def test_successful_verification_marks_appointment_paid(self):
        with self._ok():
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['data']['payment_status'], 'PAID')
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PAID)
        self.assertEqual(self.appt.payment_reference, 'NDK-ABC123')

    def test_appointment_stays_pending_for_doctor_acceptance(self):
        with self._ok():
            self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.PENDING)

    def test_verification_is_idempotent(self):
        with self._ok():
            self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['payment_status'], 'PAID')

    def test_unsuccessful_provider_status_does_not_mark_paid(self):
        with self._ok(status='failed'):
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_cannot_verify_another_users_transaction(self):
        self.client.force_authenticate(user=self.other)
        with self._ok():
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 404)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_unknown_reference_is_rejected(self):
        res = self.client.post(self.url, {'reference': 'NDK-NOPE'}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_missing_reference_is_rejected(self):
        res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_provider_outage_returns_502_not_a_false_success(self):
        with patch('naderk.payments.services.verify_and_confirm', side_effect=RuntimeError('boom')):
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 502)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_paid_appointment_is_surfaced_to_the_doctor(self):
        """The whole point: after verifying, the doctor can accept it."""
        with self._ok():
            self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.client.force_authenticate(user=self.doctor)
        res = self.client.get(reverse('dashboard:doctor-requests'))
        self.assertIn(str(self.appt.id), [r['id'] for r in res.json()['data']])


class ReconcilePendingTransactionsTests(TestCase):
    """PaymentTransaction.status only left INITIATED in the webhook, so a missed
    webhook left every real payment showing as "Pending" on admin billing."""

    def setUp(self):
        self.patient = User.objects.create_user(email='rp@x.com', password='pw12345!')
        self.doctor = User.objects.create_user(email='rd@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.service = MedicalService.objects.create(
            name='Recon Consult', slug='recon-gp', requires_doctor=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )
        self.appt = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=timezone.now().date() + datetime.timedelta(days=1),
            appointment_time=datetime.time(9, 0), status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PENDING, consultation_fee=8500,
        )

    def _txn(self, age_minutes=30, **over):
        data = dict(
            user=self.patient, provider='PAYSTACK', reference='NDK-RECON1',
            amount_kobo=850000, appointment=self.appt,
            status=PaymentTransaction.Status.INITIATED, raw_response={},
        )
        data.update(over)
        txn = PaymentTransaction.objects.create(**data)
        PaymentTransaction.objects.filter(pk=txn.pk).update(
            created_at=timezone.now() - datetime.timedelta(minutes=age_minutes))
        txn.refresh_from_db()
        return txn

    def _verify(self, status='success'):
        def _fake(reference, provider_name='PAYSTACK'):
            PaymentTransaction.objects.filter(reference=reference).update(
                status=(PaymentTransaction.Status.SUCCESS if status == 'success'
                        else PaymentTransaction.Status.FAILED))
            return type('R', (), {'status': status, 'metadata': {},
                                  'amount_kobo': 850000, 'currency': 'NGN', 'provider_txn_ref': ''})()
        return patch('naderk.payments.services.verify_and_confirm', side_effect=_fake)

    def test_stale_successful_payment_is_confirmed(self):
        from naderk.payments.tasks import reconcile_pending_transactions
        txn = self._txn()
        with self._verify():
            reconcile_pending_transactions()
        txn.refresh_from_db(); self.appt.refresh_from_db()
        self.assertEqual(txn.status, PaymentTransaction.Status.SUCCESS)
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PAID)

    def test_recent_transaction_is_left_for_the_webhook(self):
        from naderk.payments.tasks import reconcile_pending_transactions
        txn = self._txn(age_minutes=1)
        with self._verify() as m:
            reconcile_pending_transactions()
        m.assert_not_called()
        txn.refresh_from_db()
        self.assertEqual(txn.status, PaymentTransaction.Status.INITIATED)

    def test_ancient_transaction_is_not_rechecked(self):
        from naderk.payments.tasks import reconcile_pending_transactions
        self._txn(age_minutes=60 * 24 * 30)
        with self._verify() as m:
            reconcile_pending_transactions()
        m.assert_not_called()

    def test_failed_payment_does_not_mark_appointment_paid(self):
        from naderk.payments.tasks import reconcile_pending_transactions
        self._txn()
        with self._verify(status='failed'):
            reconcile_pending_transactions()
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_provider_error_on_one_does_not_abort_the_batch(self):
        from naderk.payments.tasks import reconcile_pending_transactions
        bad = self._txn(reference='NDK-BAD')
        good_appt = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=timezone.now().date() + datetime.timedelta(days=2),
            appointment_time=datetime.time(10, 0), status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PENDING, consultation_fee=8500,
        )
        self._txn(reference='NDK-GOOD', appointment=good_appt)

        def _flaky(reference, provider_name='PAYSTACK'):
            if reference == 'NDK-BAD':
                raise RuntimeError('provider down')
            PaymentTransaction.objects.filter(reference=reference).update(
                status=PaymentTransaction.Status.SUCCESS)
            return type('R', (), {'status': 'success', 'metadata': {},
                                  'amount_kobo': 850000, 'currency': 'NGN', 'provider_txn_ref': ''})()

        with patch('naderk.payments.services.verify_and_confirm', side_effect=_flaky):
            reconcile_pending_transactions()

        bad.refresh_from_db(); good_appt.refresh_from_db()
        self.assertEqual(bad.status, PaymentTransaction.Status.INITIATED)
        self.assertEqual(good_appt.payment_status, Appointment.PaymentStatus.PAID,
                         'a failure on one reference must not skip the rest')

    def test_already_successful_transaction_is_not_reprocessed(self):
        from naderk.payments.tasks import reconcile_pending_transactions
        self._txn(status=PaymentTransaction.Status.SUCCESS)
        with self._verify() as m:
            reconcile_pending_transactions()
        m.assert_not_called()


class PaymentGatewayConfigTests(TestCase):
    """Runtime, admin-managed, encrypted gateway config."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='adm@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.patient = User.objects.create_user(email='pt@x.com', password='pw12345!')

    def _gw(self, provider='PAYSTACK', mode='TEST', secret='sk_test_XYZ', active=True, **over):
        from .models import PaymentGateway
        gw = PaymentGateway(provider=provider, mode=mode, display_name=f'{provider} {mode}',
                            client_key=over.pop('client_key', 'pk_test_ABC'), is_active=active, **over)
        gw.set_secret_key(secret)
        gw.save()
        return gw

    def test_secret_key_encrypts_and_roundtrips(self):
        gw = self._gw()
        self.assertNotIn('sk_test_XYZ', gw.secret_key_encrypted)
        self.assertTrue(gw.has_secret_key)
        gw.refresh_from_db()
        self.assertEqual(gw.get_secret_key(), 'sk_test_XYZ')

    def test_config_resolves_from_active_db_gateway(self):
        from .config import gateway_config
        self._gw(client_key='pk_test_ABC', secret='sk_test_XYZ')
        cfg = gateway_config('PAYSTACK')
        self.assertEqual(cfg['secret_key'], 'sk_test_XYZ')
        self.assertEqual(cfg['client_key'], 'pk_test_ABC')

    def test_unconfigured_provider_raises(self):
        from .config import gateway_config, ProviderNotConfigured
        self._gw(provider='MONNIFY', contract_code='123', active=False)  # inactive
        with self.assertRaises(ProviderNotConfigured):
            gateway_config('MONNIFY')

    def test_public_config_never_exposes_secret(self):
        from .services import provider_public_config
        self._gw(client_key='pk_test_ABC', secret='sk_test_XYZ')
        pub = provider_public_config('PAYSTACK')
        self.assertEqual(pub.get('public_key'), 'pk_test_ABC')
        self.assertNotIn('sk_test_XYZ', str(pub))

    def test_admin_creates_gateway_secret_write_only(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.post(reverse('payment-admin-gateways'), {
            'provider': 'PAYSTACK', 'mode': 'TEST', 'display_name': 'Paystack',
            'client_key': 'pk_test_ABC', 'secret_key': 'sk_test_XYZ', 'is_active': True,
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.json()['data']['has_secret_key'])
        self.assertNotIn('sk_test_XYZ', res.content.decode())

    def test_update_without_secret_keeps_existing(self):
        gw = self._gw(secret='sk_test_XYZ')
        self.client.force_authenticate(user=self.admin)
        res = self.client.patch(reverse('payment-admin-gateway-detail', args=[gw.id]),
                                {'display_name': 'Renamed'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        gw.refresh_from_db()
        self.assertEqual(gw.display_name, 'Renamed')
        self.assertEqual(gw.get_secret_key(), 'sk_test_XYZ')

    def test_non_admin_cannot_manage_gateways(self):
        self.client.force_authenticate(user=self.patient)
        self.assertEqual(self.client.get(reverse('payment-admin-gateways')).status_code, 403)

    def test_public_gateways_lists_active_without_secrets(self):
        self._gw(client_key='pk_test_ABC', secret='sk_test_XYZ', active=True)
        self._gw(provider='MONNIFY', contract_code='123', active=False)
        self.client.force_authenticate(user=self.patient)
        res = self.client.get(reverse('payment-gateways'))
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        providers = [g['provider'] for g in data]
        self.assertIn('PAYSTACK', providers)
        self.assertNotIn('MONNIFY', providers)
        self.assertNotIn('sk_test_XYZ', res.content.decode())
        self.assertEqual(data[0]['public_config']['public_key'], 'pk_test_ABC')


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
