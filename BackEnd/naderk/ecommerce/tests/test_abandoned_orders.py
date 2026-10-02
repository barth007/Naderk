from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from datetime import timedelta
from decimal import Decimal
from naderk.ecommerce.models import StoreCategory, Product, Order, OrderItem
from naderk.ecommerce.services import order_process_payment

User = get_user_model()


class AbandonedOrderCleanupTests(TestCase):
    """
    Stock is deducted only when payment succeeds, so an abandoned checkout
    holds no stock — but it used to sit on the patient's Orders page as an
    ordinary pending order forever, which reads as a purchase that failed to
    reduce inventory.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            email='abandon@test.com', password='pw12345!', role='PATIENT'
        )
        self.category = StoreCategory.objects.create(name='Drops', slug='drops')
        self.product = Product.objects.create(
            name='Test Drops', slug='test-drops', category=self.category,
            price=Decimal('1000.00'), quantity_available=30, low_stock_threshold=5,
        )

    def _order(self, *, status, payment_status, total=Decimal('1000.00'), age_minutes=120):
        order = Order.objects.create(
            user=self.user, status=status, payment_status=payment_status,
            total_price=total, shipping_address='somewhere',
        )
        OrderItem.objects.create(order=order, product=self.product, quantity=4, price=self.product.price)
        # created_at is auto_now_add, so age it explicitly.
        Order.objects.filter(pk=order.pk).update(
            created_at=timezone.now() - timedelta(minutes=age_minutes)
        )
        return order

    def test_cancels_stale_unpaid_order_without_touching_stock(self):
        from naderk.ecommerce.tasks import cancel_abandoned_unpaid_orders

        order = self._order(status=Order.Status.PENDING, payment_status=Order.PaymentStatus.UNPAID)

        cancel_abandoned_unpaid_orders()

        order.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(order.status, Order.Status.CANCELLED)
        self.assertEqual(order.payment_status, Order.PaymentStatus.FAILED)
        # The order never paid, so it never held stock — cancelling must not
        # restore units that were never deducted.
        self.assertEqual(self.product.quantity_available, 30)
        self.assertTrue(order.activities.filter(action='CANCELLED').exists())

    def test_leaves_recent_unpaid_order_alone(self):
        from naderk.ecommerce.tasks import cancel_abandoned_unpaid_orders

        order = self._order(
            status=Order.Status.PENDING, payment_status=Order.PaymentStatus.UNPAID,
            age_minutes=5,
        )
        cancel_abandoned_unpaid_orders()
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_leaves_paid_order_alone(self):
        from naderk.ecommerce.tasks import cancel_abandoned_unpaid_orders

        order = self._order(status=Order.Status.PENDING, payment_status=Order.PaymentStatus.PAID)
        cancel_abandoned_unpaid_orders()
        order.refresh_from_db()
        self.assertEqual(order.status, Order.Status.PENDING)

    def test_free_order_is_never_an_abandoned_checkout(self):
        order = self._order(
            status=Order.Status.PENDING, payment_status=Order.PaymentStatus.UNPAID,
            total=Decimal('0.00'),
        )
        self.assertNotIn(order, Order.objects.unpaid_checkouts())
        self.assertIn(order, Order.objects.exclude_unpaid_checkouts())

    def test_payment_deducts_stock(self):
        """The behaviour the cleanup depends on: stock moves on payment, not placement."""
        order = self._order(status=Order.Status.PENDING, payment_status=Order.PaymentStatus.UNPAID)
        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity_available, 30)

        order_process_payment(
            order=order, actor=self.user, payment_reference='TEST-REF'
        )

        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity_available, 26)
