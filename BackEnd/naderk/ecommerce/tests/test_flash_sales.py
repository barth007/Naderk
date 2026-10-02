"""A flash sale is the price the customer is shown and the price they are charged."""
from decimal import Decimal

import pytest

from naderk.ecommerce.serializers import ProductSerializer
from naderk.ecommerce.services import cart_add_item, order_create_from_cart
from naderk.ecommerce.tests import factories

pytestmark = pytest.mark.django_db


def test_cart_charges_the_sale_price(patient):
    item = factories.product(price='1000.00')
    factories.flash_sale(item, percent='25.00')

    cart_item = cart_add_item(user=patient, product_id=item.id, quantity=2)

    assert cart_item.price == Decimal('750.00')


def test_variant_modifier_is_added_after_the_discount(patient):
    item = factories.product(price='1000.00')
    large = factories.variant(item, modifier='200.00')
    factories.flash_sale(item, percent='10.00')

    cart_item = cart_add_item(user=patient, product_id=item.id, product_variant_id=large.id)

    assert cart_item.price == Decimal('1100.00')


@pytest.mark.parametrize('sale', [
    {'active': False},
    {'started_hours_ago': -1, 'ends_in_hours': 2},   # not started yet
    {'started_hours_ago': 3, 'ends_in_hours': -1},   # already over
])
def test_inactive_or_out_of_window_sale_is_ignored(patient, sale):
    item = factories.product(price='1000.00')
    factories.flash_sale(item, **sale)

    assert cart_add_item(user=patient, product_id=item.id).price == Decimal('1000.00')


def test_sale_only_applies_to_its_own_products(patient):
    on_sale, full_price = factories.product('drops'), factories.product('wipes')
    factories.flash_sale(on_sale)

    assert cart_add_item(user=patient, product_id=full_price.id).price == Decimal('1000.00')


def test_serializer_and_cart_agree_on_the_price(patient):
    item = factories.product(price='999.99')
    factories.flash_sale(item, percent='33.00')

    shown = Decimal(ProductSerializer(item).data['sale_price'])
    charged = cart_add_item(user=patient, product_id=item.id).price

    assert shown == charged == Decimal('669.99')


def test_checkout_reprices_when_the_sale_ended_after_adding_to_cart(patient):
    item = factories.product(price='1000.00')
    sale = factories.flash_sale(item, percent='25.00')
    cart_add_item(user=patient, product_id=item.id, quantity=2)

    sale.is_active = False
    sale.save()
    order = order_create_from_cart(user=patient, shipping_address='1 Test Street')

    assert order.total_price == Decimal('2000.00')
    assert order.items.get().price == Decimal('1000.00')
