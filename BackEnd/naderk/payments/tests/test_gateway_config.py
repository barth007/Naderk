from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from naderk.core.models import User


class PaymentGatewayConfigTests(TestCase):
    """Runtime, admin-managed, encrypted gateway config."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='adm@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.patient = User.objects.create_user(email='pt@x.com', password='pw12345!')

    def _gw(self, provider='PAYSTACK', mode='TEST', secret='sk_test_XYZ', active=True, **over):
        from naderk.payments.models import PaymentGateway
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
        from naderk.payments.config import gateway_config
        self._gw(client_key='pk_test_ABC', secret='sk_test_XYZ')
        cfg = gateway_config('PAYSTACK')
        self.assertEqual(cfg['secret_key'], 'sk_test_XYZ')
        self.assertEqual(cfg['client_key'], 'pk_test_ABC')

    def test_unconfigured_provider_raises(self):
        from naderk.payments.config import gateway_config, ProviderNotConfigured
        self._gw(provider='MONNIFY', contract_code='123', active=False)  # inactive
        with self.assertRaises(ProviderNotConfigured):
            gateway_config('MONNIFY')

    def test_public_config_never_exposes_secret(self):
        from naderk.payments.services import provider_public_config
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
