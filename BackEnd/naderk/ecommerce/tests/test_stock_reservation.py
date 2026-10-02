"""Stock is held when the order is created, so a paid order can never be out of stock."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from tests.helpers import client_for
from naderk.ecommerce.models import Cart, Order, OrderItem
from naderk.ecommerce.services import (
    cart_add_item, order_create_from_cart, order_process_payment, order_update_status,
)
from naderk.ecommerce.tasks import cancel_abandoned_unpaid_orders
from naderk.ecommerce.tests import factories

pytestmark = pytest.mark.django_db


def checkout(user, item, quantity=1, **cart):
    cart_add_item(user=user, product_id=item.id, quantity=quantity, **cart)
    return order_create_from_cart(user=user, shipping_address='1 Test Street')


def test_checkout_reserves_stock(patient):
    item = factories.product(stock=10)

    order = checkout(patient, item, quantity=4)

    item.refresh_from_db()
    assert item.quantity_available == 6
    assert order.stock_reserved is True


def test_checkout_reserves_variant_and_product_totals(patient):
    item = factories.product(stock=10)
    size = factories.variant(item, stock=10)

    checkout(patient, item, quantity=3, product_variant_id=size.id)

    item.refresh_from_db()
    size.refresh_from_db()
    assert (size.quantity_available, item.quantity_available) == (7, 7)


def test_checkout_reserves_frames(patient):
    frame = factories.frame_variant(stock=5)
    lens = factories.lens_type('Non-Prescription', compatible_with=frame)
    cart_add_item(user=patient, frame_variant_id=frame.id, lens_type_id=lens.id, quantity=2)

    order_create_from_cart(user=patient, shipping_address='1 Test Street')

    frame.refresh_from_db()
    assert frame.quantity_available == 3


def test_checkout_refuses_when_stock_is_short_and_keeps_the_cart(patient):
    item = factories.product(stock=2)
    cart_add_item(user=patient, product_id=item.id, quantity=3)

    with pytest.raises(ValidationError, match='Insufficient stock'):
        order_create_from_cart(user=patient, shipping_address='1 Test Street')

    item.refresh_from_db()
    assert item.quantity_available == 2
    assert not Order.objects.exists()
    assert Cart.objects.get(user=patient).items.count() == 1


def test_second_buyer_cannot_take_reserved_stock(patient, other_patient):
    item = factories.product(stock=1)
    checkout(patient, item)

    cart_add_item(user=other_patient, product_id=item.id)
    with pytest.raises(ValidationError, match='Insufficient stock'):
        order_create_from_cart(user=other_patient, shipping_address='2 Test Street')


def test_payment_does_not_deduct_a_second_time(patient):
    item = factories.product(stock=10)
    order = checkout(patient, item, quantity=4)

    order = order_process_payment(order=order, actor=patient, payment_reference='REF-1')

    item.refresh_from_db()
    assert item.quantity_available == 6
    assert order.payment_status == Order.PaymentStatus.PAID
    assert order.status == Order.Status.FRAME_RESERVED


def test_abandoned_order_gives_its_stock_back(patient):
    item = factories.product(stock=10)
    order = checkout(patient, item, quantity=4)
    Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(hours=2))

    cancel_abandoned_unpaid_orders()

    item.refresh_from_db()
    order.refresh_from_db()
    assert item.quantity_available == 10
    assert order.status == Order.Status.CANCELLED
    assert order.stock_reserved is False


def test_cancelling_a_paid_order_gives_its_stock_back_once(patient, admin_user):
    item = factories.product(stock=10)
    order = checkout(patient, item, quantity=4)
    order = order_process_payment(order=order, actor=patient, payment_reference='REF-1')

    order = order_update_status(order=order, actor=admin_user, new_status=Order.Status.CANCELLED)
    cancel_abandoned_unpaid_orders()   # must not release a second time

    item.refresh_from_db()
    assert item.quantity_available == 10
    assert order.stock_reserved is False


def test_rejecting_the_prescription_gives_stock_back(patient, admin_user):
    frame = factories.frame_variant(stock=5)
    lens = factories.lens_type(compatible_with=frame)
    cart_add_item(
        user=patient, frame_variant_id=frame.id, lens_type_id=lens.id,
        prescription_id=factories.prescription(patient).id,
    )
    order = order_create_from_cart(user=patient, shipping_address='1 Test Street')
    order = order_process_payment(order=order, actor=patient, payment_reference='REF-1')
    assert order.status == Order.Status.PRESCRIPTION_REVIEW

    res = client_for(admin_user).post(
        f'/api/v1/marketplace/orders/{order.id}/review/', {'action': 'reject'}, format='json',
    )

    assert res.status_code == 200, res.content
    frame.refresh_from_db()
    assert frame.quantity_available == 5


def test_late_payment_on_a_swept_order_takes_the_stock_again(patient):
    item = factories.product(stock=10)
    order = checkout(patient, item, quantity=4)
    Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(hours=2))
    cancel_abandoned_unpaid_orders()

    order = order_process_payment(order=order, actor=patient, payment_reference='REF-LATE')

    item.refresh_from_db()
    assert item.quantity_available == 6
    assert order.payment_status == Order.PaymentStatus.PAID
    assert order.status == Order.Status.FRAME_RESERVED


def test_late_payment_with_no_stock_left_is_recorded_and_flagged(patient, other_patient):
    item = factories.product(stock=4)
    order = checkout(patient, item, quantity=4)
    Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(hours=2))
    cancel_abandoned_unpaid_orders()
    checkout(other_patient, item, quantity=4)      # someone else bought it meanwhile

    order = order_process_payment(order=order, actor=patient, payment_reference='REF-LATE')

    assert order.payment_status == Order.PaymentStatus.PAID
    assert order.payment_reference == 'REF-LATE'
    assert order.status == Order.Status.CANCELLED
    assert order.activities.filter(action='PAYMENT_NEEDS_REFUND').exists()


def test_order_created_before_reservation_still_deducts_at_payment(patient):
    """Orders in flight when this shipped were never reserved."""
    item = factories.product(stock=10)
    order = Order.objects.create(
        user=patient, total_price=Decimal('4000.00'), shipping_address='somewhere',
    )
    OrderItem.objects.create(order=order, product=item, quantity=4, price=item.price)

    order_process_payment(order=order, actor=patient, payment_reference='REF-OLD')

    item.refresh_from_db()
    assert item.quantity_available == 6
