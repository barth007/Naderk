from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient


class MonnifyProviderTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _provider(self, mode='TEST'):
        from naderk.payments.providers.monnify import MonnifyProvider
        return MonnifyProvider({'client_key': 'MK_TEST', 'secret_key': 'sk_test',
                                'contract_code': '123', 'mode': mode, 'gateway_id': 'g1'})

    def _resp(self, body):
        return type('Resp', (), {'raise_for_status': lambda self: None,
                                 'json': lambda self: body})()

    def test_verify_maps_paid_and_converts_naira_to_kobo(self):
        p = self._provider()
        body = {'responseBody': {'paymentStatus': 'PAID', 'amountPaid': '5000.00',
                                 'currencyCode': 'NGN', 'transactionReference': 'MNFY|77'}}
        with patch.object(type(p), '_access_token', return_value='tok'), \
             patch('naderk.payments.providers.monnify.requests.get', return_value=self._resp(body)):
            res = p.verify(reference='NDK-M1')
        self.assertEqual(res.status, 'success')
        self.assertEqual(res.amount_kobo, 500000)
        self.assertEqual(res.provider_txn_ref, 'MNFY|77')

    def test_verify_pending_is_not_success(self):
        p = self._provider()
        body = {'responseBody': {'paymentStatus': 'PENDING', 'amountPaid': '0'}}
        with patch.object(type(p), '_access_token', return_value='tok'), \
             patch('naderk.payments.providers.monnify.requests.get', return_value=self._resp(body)):
            res = p.verify(reference='NDK-M1')
        self.assertNotEqual(res.status, 'success')

    def test_webhook_signature_tolerated_in_sandbox_only(self):
        self.assertTrue(self._provider('TEST').verify_webhook(payload=b'{}', signature=''))
        self.assertFalse(self._provider('LIVE').verify_webhook(payload=b'{}', signature=''))

    def test_webhook_valid_hmac_signature_accepted(self):
        import hmac as _h, hashlib as _hh
        p = self._provider(mode='LIVE')
        body = b'{"eventType":"SUCCESSFUL_TRANSACTION"}'
        sig = _h.new(b'sk_test', body, _hh.sha512).hexdigest()
        self.assertTrue(p.verify_webhook(payload=body, signature=sig))
        self.assertFalse(p.verify_webhook(payload=body, signature='deadbeef'))

    def test_parse_webhook_extracts_reference(self):
        parsed = self._provider().parse_webhook(
            {'eventType': 'SUCCESSFUL_TRANSACTION', 'eventData': {'paymentReference': 'NDK-M1'}})
        self.assertEqual(parsed['reference'], 'NDK-M1')

    def test_public_config_has_no_secret(self):
        pub = self._provider().public_config()
        self.assertEqual(pub['apiKey'], 'MK_TEST')
        self.assertEqual(pub['contractCode'], '123')
        self.assertNotIn('sk_test', str(pub))

    def test_monnify_webhook_records_in_sandbox(self):
        from naderk.payments.models import PaymentWebhookEvent
        body = {'eventType': 'SUCCESSFUL_TRANSACTION', 'eventData': {'paymentReference': 'NDK-M1'}}
        with patch('naderk.payments.tasks.process_payment_webhook.delay') as delay:
            res = self.client.post(reverse('webhook-monnify'), body, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(PaymentWebhookEvent.objects.filter(provider='MONNIFY').exists())
        delay.assert_called_once()
