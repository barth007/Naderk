"""Store checkout: the server decides what an order costs and which payment settles it."""
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from naderk.ecommerce.models import Cart, Order
from naderk.ecommerce.services import cart_add_item
from naderk.ecommerce.tests import factories
from naderk.payments.models import PaymentTransaction
from naderk.payments.providers.base import PaymentInitResult
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

INITIALIZE = '/api/v1/payments/initialize/'


class FakeProvider:
    """Stands in for Paystack: remembers what it was asked to charge."""

    def __init__(self):
        self.charged = None

    def initialize(self, *, amount_kobo, email, reference, metadata, currency="NGN"):
        self.charged = amount_kobo
        return PaymentInitResult(reference=reference, access_code='AC', provider='PAYSTACK',
                                 public_config={'public_key': 'pk_test'})


@pytest.fixture
def provider():
    fake = FakeProvider()
    with patch('naderk.payments.services.get_provider', return_value=fake):
        yield fake


def verified(amount_kobo, status='success'):
    """Patch the provider's answer to 'was this reference paid, and how much?'"""
    return patch(
        'naderk.payments.services.verify_and_confirm',
        return_value=SimpleNamespace(status=status, amount_kobo=amount_kobo, currency='NGN',
                                     metadata={}, provider_txn_ref=''),
    )


def initialize(user, **body):
    body.setdefault('shipping_address', '1 Test Street')
    return client_for(user).post(INITIALIZE, body, format='json')


def test_amount_comes_from_the_order_not_the_request(patient, provider):
    cart_add_item(user=patient, product_id=factories.product(price='1000.00').id, quantity=3)

    res = initialize(patient, amount_kobo=100)     # a tampered ₦1

    assert res.status_code == 200, res.content
    assert provider.charged == 300_000
    assert res.json()['data']['amount_kobo'] == 300_000
    assert PaymentTransaction.objects.get().amount_kobo == 300_000


def test_amount_is_not_required_from_the_client(patient, provider):
    cart_add_item(user=patient, product_id=factories.product(price='1000.00').id)

    res = initialize(patient)

    assert res.status_code == 200, res.content
    assert provider.charged == 100_000


def test_underpaying_the_real_total_does_not_settle_the_order(patient, provider):
    cart_add_item(user=patient, product_id=factories.product(price='1000.00').id, quantity=3)
    reference = initialize(patient, amount_kobo=100).json()['data']['reference']

    with verified(amount_kobo=100):
        client_for(patient).post('/api/v1/payments/verify-order/', {'reference': reference}, format='json')

    assert Order.objects.get().payment_status == Order.PaymentStatus.UNPAID


def test_out_of_stock_is_refused_before_any_payment_starts(patient, provider):
    item = factories.product(stock=1)
    cart_add_item(user=patient, product_id=item.id, quantity=2)

    res = initialize(patient)

    assert res.status_code == 400, res.content
    assert 'Insufficient stock' in res.json()['detail']
    assert provider.charged is None
    assert not PaymentTransaction.objects.exists()


def test_provider_failure_leaves_cart_and_stock_untouched(patient):
    item = factories.product(stock=5)
    cart_add_item(user=patient, product_id=item.id, quantity=2)

    with patch('naderk.payments.services.get_provider') as get_provider:
        get_provider.return_value.initialize.side_effect = RuntimeError('provider down')
        res = initialize(patient)

    assert res.status_code == 502, res.content
    item.refresh_from_db()
    assert item.quantity_available == 5
    assert not Order.objects.exists()
    assert Cart.objects.get(user=patient).items.count() == 1


# ── The older /marketplace/ pay routes ───────────────────────────────────────

def initialized_order(user):
    cart_add_item(user=user, product_id=factories.product('paid-item').id)
    data = initialize(user).json()['data']
    return Order.objects.get(id=data['order_id']), data['reference']


def test_pay_route_rejects_a_reference_from_another_order(patient, provider):
    _, other_reference = initialized_order(patient)
    cart_add_item(user=patient, product_id=factories.product('wanted-item', price='90000.00').id)
    target = Order.objects.get(id=initialize(patient).json()['data']['order_id'])

    with verified(amount_kobo=100_000):
        res = client_for(patient).post(
            f'/api/v1/marketplace/orders/{target.id}/pay/',
            {'payment_reference': other_reference}, format='json',
        )

    assert res.status_code == 400, res.content
    target.refresh_from_db()
    assert target.payment_status == Order.PaymentStatus.UNPAID


def test_pay_route_rejects_a_made_up_reference(patient, provider):
    order, _ = initialized_order(patient)

    with verified(amount_kobo=100_000):
        res = client_for(patient).post(
            f'/api/v1/marketplace/orders/{order.id}/pay/',
            {'payment_reference': 'ANYTHING'}, format='json',
        )

    assert res.status_code == 400, res.content
    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.UNPAID


def test_pay_route_settles_the_order_with_its_own_verified_payment(patient, provider):
    order, reference = initialized_order(patient)

    with verified(amount_kobo=100_000):
        res = client_for(patient).post(
            f'/api/v1/marketplace/orders/{order.id}/pay/',
            {'payment_reference': reference}, format='json',
        )

    assert res.status_code == 200, res.content
    order.refresh_from_db()
    assert order.payment_status == Order.PaymentStatus.PAID


def test_checkout_route_does_not_take_a_payment_reference(patient):
    cart_add_item(user=patient, product_id=factories.product().id)

    with verified(amount_kobo=1):
        res = client_for(patient).post(
            '/api/v1/marketplace/checkout/',
            {'shipping_address': '1 Test Street', 'payment_reference': 'ANYTHING'}, format='json',
        )

    assert res.status_code == 400, res.content
    assert not Order.objects.exists()
