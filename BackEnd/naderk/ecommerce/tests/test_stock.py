from django.test import TestCase
from django.contrib.auth import get_user_model
from decimal import Decimal
from naderk.ecommerce.models import StoreCategory, Product, ProductVariant, Order, OrderItem
from naderk.ecommerce.services import order_process_payment

User = get_user_model()


class ProductVariantStockSyncTests(TestCase):
    """
    Product.quantity_available is the total across a product's variants, and is
    what the admin inventory page, its summary totals and the product
    serializers all read.

    A sale used to decrement only the variant and a restock used to increment
    only the product, so the two drifted apart: six units could sell while the
    displayed stock never moved.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            email='stocksync@test.com', password='pw12345!', role='PATIENT'
        )
        self.category = StoreCategory.objects.create(name='Optics', slug='optics')
        self.product = Product.objects.create(
            name='Frogskins', slug='frogskins', category=self.category,
            price=Decimal('1000.00'), quantity_available=30, low_stock_threshold=5,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, variant_name='Standard', sku='FROG-STD',
            quantity_available=30, low_stock_threshold=5,
        )

    def test_selling_a_variant_reduces_the_product_total(self):
        order = Order.objects.create(
            user=self.user, status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.UNPAID,
            total_price=Decimal('4000.00'), shipping_address='somewhere',
        )
        # Checkout sets both product and product_variant on the item, and the
        # deduction branches on product_variant first.
        OrderItem.objects.create(
            order=order, product=self.product, product_variant=self.variant,
            quantity=4, price=self.product.price,
        )

        order_process_payment(
            order=order, actor=self.user, payment_reference='REF-1', skip_verify=True
        )

        self.variant.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(self.variant.quantity_available, 26)
        self.assertEqual(self.product.quantity_available, 26)

    def test_product_without_variants_still_deducts(self):
        plain = Product.objects.create(
            name='Eye Drops', slug='eye-drops', category=self.category,
            price=Decimal('500.00'), quantity_available=30, low_stock_threshold=5,
        )
        order = Order.objects.create(
            user=self.user, status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.UNPAID,
            total_price=Decimal('2000.00'), shipping_address='somewhere',
        )
        OrderItem.objects.create(order=order, product=plain, quantity=4, price=plain.price)

        order_process_payment(
            order=order, actor=self.user, payment_reference='REF-2', skip_verify=True
        )

        plain.refresh_from_db()
        self.assertEqual(plain.quantity_available, 26)

    def test_reconcile_command_realigns_drift(self):
        from django.core.management import call_command
        from io import StringIO

        # Simulate the pre-fix state: variant sold down, product left behind.
        ProductVariant.objects.filter(pk=self.variant.pk).update(quantity_available=26)
        Product.objects.filter(pk=self.product.pk).update(quantity_available=30)

        call_command('reconcile_product_stock', '--apply', stdout=StringIO())

        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity_available, 26)


class AdminRestockTests(TestCase):
    """Restocking must reach the counter a sale deducts from."""

    def setUp(self):
        from rest_framework.test import APIClient

        self.admin = User.objects.create_user(
            email='restock-admin@test.com', password='pw12345!', role='ADMIN'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)

        self.category = StoreCategory.objects.create(name='Optics', slug='optics-restock')
        self.product = Product.objects.create(
            name='Frogskins R', slug='frogskins-r', category=self.category,
            price=Decimal('1000.00'), quantity_available=46, low_stock_threshold=5,
        )
        self.variant = ProductVariant.objects.create(
            product=self.product, variant_name='Standard', sku='FROG-R-STD',
            quantity_available=46, low_stock_threshold=5,
        )

    def _url(self, pk):
        return f'/api/v1/dashboard/admin/products/{pk}/restock/'

    def test_restock_updates_variant_and_product_together(self):
        res = self.client.post(self._url(self.product.id), {'quantity': 10}, format='json')
        self.assertEqual(res.status_code, 200)

        self.product.refresh_from_db()
        self.variant.refresh_from_db()
        # Previously only the product moved, so restocked units never became
        # sellable and the two counters drifted apart.
        self.assertEqual(self.variant.quantity_available, 56)
        self.assertEqual(self.product.quantity_available, 56)

    def test_restock_requires_variant_id_when_ambiguous(self):
        ProductVariant.objects.create(
            product=self.product, variant_name='Large', sku='FROG-R-LG',
            quantity_available=5, low_stock_threshold=1,
        )
        res = self.client.post(self._url(self.product.id), {'quantity': 10}, format='json')
        self.assertEqual(res.status_code, 400)

        self.product.refresh_from_db()
        self.assertEqual(self.product.quantity_available, 46)

    def test_restock_named_variant(self):
        large = ProductVariant.objects.create(
            product=self.product, variant_name='Large', sku='FROG-R-LG2',
            quantity_available=5, low_stock_threshold=1,
        )
        res = self.client.post(
            self._url(self.product.id),
            {'quantity': 10, 'variant_id': str(large.id)},
            format='json',
        )
        self.assertEqual(res.status_code, 200)

        large.refresh_from_db()
        self.variant.refresh_from_db()
        self.product.refresh_from_db()
        self.assertEqual(large.quantity_available, 15)
        self.assertEqual(self.variant.quantity_available, 46)
        self.assertEqual(self.product.quantity_available, 56)

    def test_product_without_variants_restocks_normally(self):
        plain = Product.objects.create(
            name='Plain Drops', slug='plain-drops', category=self.category,
            price=Decimal('100.00'), quantity_available=30, low_stock_threshold=5,
        )
        res = self.client.post(self._url(plain.id), {'quantity': 5}, format='json')
        self.assertEqual(res.status_code, 200)
        plain.refresh_from_db()
        self.assertEqual(plain.quantity_available, 35)
