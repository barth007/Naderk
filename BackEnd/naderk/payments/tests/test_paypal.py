"""PayPal: the adapter's mapping of PayPal's orders, and dollar checkout for a Naira shop."""
from unittest.mock import patch

import pytest

from naderk.ecommerce.models import Cart
from naderk.ecommerce.services import cart_add_item
from naderk.ecommerce.tests import factories
from naderk.payments.models import PaymentGateway, PaymentTransaction
from naderk.payments.providers.base import PaymentInitResult
from naderk.payments.providers.paypal import PayPalProvider
from naderk.payments.services import paypal_usd_minor
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

INITIALIZE = '/api/v1/payments/initialize/'
GATEWAYS = '/api/v1/payments/gateways/'
WEBHOOK = '/api/v1/payments/webhook/paypal/'


class Resp:
    def __init__(self, body, status=200):
        self.body, self.status_code, self.text = body, status, str(body)

    def raise_for_status(self):
        if self.status_code >= 400:
            raise AssertionError(f"HTTP {self.status_code}")

    def json(self):
        return self.body


def make_provider(**extras):
    return PayPalProvider({'client_key': 'cid', 'secret_key': 'sec', 'mode': 'TEST',
                           'gateway_id': 'g1', 'config': extras})


@pytest.fixture
def token():
    with patch.object(PayPalProvider, '_access_token', return_value='tok'):
        yield


def paypal_gateway(rate='1500', active=True, **config):
    gw = PaymentGateway(provider='PAYPAL', mode='TEST', display_name='PayPal', client_key='cid',
                        is_active=active, config={'ngn_per_usd': rate, **config})
    gw.set_secret_key('sec')
    gw.save()
    return gw


def order_body(status, capture=None):
    unit = {'custom_id': 'NDK-P1', 'amount': {'currency_code': 'USD', 'value': '20.00'}}
    if capture:
        unit['payments'] = {'captures': [capture]}
    return {'id': 'PP-ORDER-1', 'status': status, 'purchase_units': [unit]}


# ── The adapter ──────────────────────────────────────────────────────────────

def test_paypal_refuses_naira():
    with pytest.raises(ValueError, match='PayPal'):
        make_provider().initialize(amount_kobo=100, email='a@x.org', reference='NDK-1', metadata={}, currency='NGN')


def test_initialize_creates_an_order_for_the_priced_amount(token):
    created = {'id': 'PP-ORDER-1', 'status': 'CREATED',
               'links': [{'rel': 'approve', 'href': 'https://paypal.test/approve'}]}
    with patch('naderk.payments.providers.paypal.requests.post', return_value=Resp(created)) as post:
        res = make_provider().initialize(amount_kobo=2050, email='a@x.org', reference='NDK-1',
                                         metadata={}, currency='USD')

    sent = post.call_args.kwargs['json']['purchase_units'][0]
    assert sent['amount'] == {'currency_code': 'USD', 'value': '20.50'}
    assert sent['custom_id'] == 'NDK-1'
    assert post.call_args.kwargs['headers']['PayPal-Request-Id'] == 'NDK-1'
    assert res.provider_reference == 'PP-ORDER-1'
    assert res.public_config['order_id'] == 'PP-ORDER-1'
    assert res.public_config['currency'] == 'USD'
    assert 'sec' not in str(res.public_config)


def _txn(user=None):
    return PaymentTransaction.objects.create(
        user=user, provider='PAYPAL', reference='NDK-P1', provider_txn_ref='PP-ORDER-1',
        amount_kobo=2000, currency='USD',
    )


def test_an_approved_order_is_captured_and_reported_paid(token):
    _txn()
    captured = order_body('COMPLETED', {'id': 'CAP-1', 'status': 'COMPLETED',
                                        'amount': {'currency_code': 'USD', 'value': '20.00'}})
    with patch('naderk.payments.providers.paypal.requests.get', return_value=Resp(order_body('APPROVED'))), \
         patch('naderk.payments.providers.paypal.requests.post', return_value=Resp(captured)) as post:
        res = make_provider().verify(reference='NDK-P1')

    assert post.call_args.args[0].endswith('/v2/checkout/orders/PP-ORDER-1/capture')
    assert (res.status, res.amount_kobo, res.currency) == ('success', 2000, 'USD')
    assert res.provider_txn_ref == 'PP-ORDER-1'     # kept, so later verifies still find the order


def test_an_unapproved_order_is_not_paid_and_not_captured(token):
    _txn()
    with patch('naderk.payments.providers.paypal.requests.get', return_value=Resp(order_body('CREATED'))), \
         patch('naderk.payments.providers.paypal.requests.post') as post:
        res = make_provider().verify(reference='NDK-P1')

    post.assert_not_called()
    assert res.status == 'abandoned'
    assert res.amount_kobo == 0


def test_a_declined_capture_is_a_failure(token):
    _txn()
    declined = order_body('COMPLETED', {'id': 'CAP-1', 'status': 'DECLINED',
                                        'amount': {'currency_code': 'USD', 'value': '20.00'}})
    with patch('naderk.payments.providers.paypal.requests.get', return_value=Resp(declined)):
        assert make_provider().verify(reference='NDK-P1').status == 'failed'


def test_a_refused_capture_reads_the_order_again(token):
    _txn()
    done = order_body('COMPLETED', {'id': 'CAP-1', 'status': 'COMPLETED',
                                    'amount': {'currency_code': 'USD', 'value': '20.00'}})
    with patch('naderk.payments.providers.paypal.requests.get',
               side_effect=[Resp(order_body('APPROVED')), Resp(done)]), \
         patch('naderk.payments.providers.paypal.requests.post',
               return_value=Resp({'name': 'UNPROCESSABLE_ENTITY'}, status=422)):
        assert make_provider().verify(reference='NDK-P1').status == 'success'


def test_webhook_reference_is_found_on_captures_and_orders():
    p = make_provider()
    capture_event = {'event_type': 'PAYMENT.CAPTURE.COMPLETED', 'resource': {'custom_id': 'NDK-P1'}}
    order_event = {'event_type': 'CHECKOUT.ORDER.APPROVED',
                   'resource': {'purchase_units': [{'reference_id': 'NDK-P2', 'custom_id': 'NDK-P2'}]}}
    assert p.parse_webhook(capture_event) == {'event_type': 'PAYMENT.CAPTURE.COMPLETED', 'reference': 'NDK-P1'}
    assert p.parse_webhook(order_event)['reference'] == 'NDK-P2'


def test_webhook_needs_a_configured_webhook_id_and_paypals_approval(token):
    headers = {'PAYPAL-AUTH-ALGO': 'a', 'PAYPAL-CERT-URL': 'c', 'PAYPAL-TRANSMISSION-ID': 'i',
               'PAYPAL-TRANSMISSION-SIG': 's', 'PAYPAL-TRANSMISSION-TIME': 't'}
    assert make_provider().verify_webhook_request(payload=b'{}', headers=headers) is False

    p = make_provider(webhook_id='WH-1')
    with patch('naderk.payments.providers.paypal.requests.post',
               return_value=Resp({'verification_status': 'SUCCESS'})) as post:
        assert p.verify_webhook_request(payload=b'{"id": "EV-1"}', headers=headers) is True
    assert post.call_args.kwargs['json']['webhook_id'] == 'WH-1'
    with patch('naderk.payments.providers.paypal.requests.post',
               return_value=Resp({'verification_status': 'FAILURE'})):
        assert p.verify_webhook_request(payload=b'{}', headers=headers) is False


def test_an_unverified_webhook_is_refused(api_client):
    paypal_gateway()
    res = api_client.post(WEBHOOK, {'event_type': 'PAYMENT.CAPTURE.COMPLETED'}, format='json')
    assert res.status_code == 400


# ── Dollar checkout for a Naira shop ─────────────────────────────────────────

def test_naira_is_converted_at_the_admin_rate():
    paypal_gateway(rate='1500')
    assert paypal_usd_minor(3_000_000) == 2000          # ₦30,000 → $20.00
    assert paypal_usd_minor(100_000) == 67              # ₦1,000 → $0.666… → $0.67


def test_no_rate_means_no_paypal():
    paypal_gateway(rate='')
    with pytest.raises(ValueError, match='exchange rate'):
        paypal_usd_minor(100_000)


class FakePayPal:
    def __init__(self):
        self.charged = None

    def initialize(self, *, amount_kobo, email, reference, metadata, currency='NGN'):
        self.charged = (amount_kobo, currency)
        return PaymentInitResult(reference=reference, provider='PAYPAL', provider_reference='PP-ORDER-9',
                                 public_config={'client_id': 'cid', 'order_id': 'PP-ORDER-9', 'currency': currency})


def test_a_shop_order_paid_with_paypal_is_charged_in_dollars(patient):
    paypal_gateway(rate='1500')
    cart_add_item(user=patient, product_id=factories.product(price='15000.00').id, quantity=2)
    fake = FakePayPal()

    with patch('naderk.payments.services.get_provider', return_value=fake):
        res = client_for(patient).post(INITIALIZE, {'shipping_address': '1 Test Street', 'provider': 'PAYPAL'},
                                       format='json')

    assert res.status_code == 200, res.content
    data = res.json()['data']
    assert fake.charged == (2000, 'USD')                 # ₦30,000 at ₦1,500/$ = $20.00
    assert (data['amount_kobo'], data['currency']) == (2000, 'USD')
    txn = PaymentTransaction.objects.get()
    assert (txn.amount_kobo, txn.currency, txn.provider_txn_ref) == (2000, 'USD', 'PP-ORDER-9')
    assert txn.order.total_price == 30000                # the order itself stays in Naira


def test_paypal_without_a_rate_leaves_the_cart_alone(patient):
    paypal_gateway(rate='')
    cart_add_item(user=patient, product_id=factories.product(price='1000.00').id, quantity=1)

    res = client_for(patient).post(INITIALIZE, {'shipping_address': '1 Test Street', 'provider': 'PAYPAL'},
                                   format='json')

    assert res.status_code == 400
    assert not PaymentTransaction.objects.exists()
    assert Cart.objects.get(user=patient).items.count() == 1


def test_public_gateway_list_shows_the_rate_but_no_secret(api_client):
    paypal_gateway(rate='1500', webhook_id='WH-1')
    gw = next(g for g in api_client.get(GATEWAYS).json()['data'] if g['provider'] == 'PAYPAL')
    assert gw['public_config'] == {'client_id': 'cid', 'isTestMode': True, 'ngn_per_usd': '1500'}


def test_admin_cannot_save_a_nonsense_rate(admin_user):
    res = client_for(admin_user).post('/api/v1/payments/admin/gateways/', {
        'provider': 'PAYPAL', 'mode': 'TEST', 'display_name': 'PayPal', 'client_key': 'cid',
        'secret_key': 'sec', 'config': {'ngn_per_usd': '-3'},
    }, format='json')
    assert res.status_code == 400
    assert not PaymentGateway.objects.exists()
