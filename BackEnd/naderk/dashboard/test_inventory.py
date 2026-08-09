import datetime
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from naderk.core.models import User
from naderk.ecommerce.models import Product, StoreCategory


class AdminProductListTests(TestCase):
    """New products vanished from the admin table: the list was ordered
    alphabetically by category+name, and the UI paginates at 50."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='a@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.client.force_authenticate(user=self.admin)
        self.cat = StoreCategory.objects.create(name='Wellness', slug='wellness')
        self.url = reverse('dashboard:admin-products')

    def _product(self, name, qty=100, threshold=5, **over):
        data = dict(
            name=name, slug=name.lower().replace(' ', '-'), description='x',
            category=self.cat, price=Decimal('10.00'),
            quantity_available=qty, low_stock_threshold=threshold,
        )
        data.update(over)
        return Product.objects.create(**data)

    def test_newest_product_is_first(self):
        self._product('Aaa First Alphabetically')
        newest = self._product('Zzz Created Last')
        rows = self.client.get(self.url).json()['data']['products']
        self.assertEqual(rows[0]['id'], str(newest.id),
                         'a just-created product must be at the top, not buried alphabetically')

    def test_low_stock_uses_the_products_own_threshold(self):
        """Was a hardcoded < 15 that ignored low_stock_threshold entirely."""
        below = self._product('Below Threshold', qty=3, threshold=5)
        above = self._product('Above Threshold', qty=10, threshold=5)
        rows = {r['id']: r for r in self.client.get(self.url).json()['data']['products']}
        self.assertTrue(rows[str(below.id)]['low_stock'])
        self.assertFalse(rows[str(above.id)]['low_stock'],
                         'qty 10 with threshold 5 is not low, but the old hardcoded 15 said it was')

    def test_high_threshold_product_is_flagged(self):
        p = self._product('Bulk Item', qty=40, threshold=50)
        rows = {r['id']: r for r in self.client.get(self.url).json()['data']['products']}
        self.assertTrue(rows[str(p.id)]['low_stock'],
                        'a product whose own threshold is 50 is low at 40')


class AdminInventorySummaryTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='a2@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.client.force_authenticate(user=self.admin)
        self.cat = StoreCategory.objects.create(name='Wellness', slug='wellness')
        self.url = reverse('dashboard:admin-inventory-summary')

    def _product(self, name, qty, threshold=5):
        return Product.objects.create(
            name=name, slug=name.lower().replace(' ', '-'), description='x',
            category=self.cat, price=Decimal('10.00'),
            quantity_available=qty, low_stock_threshold=threshold,
        )

    def test_alert_not_capped_at_ten(self):
        """The old [:10] cap meant a newly-low product only appeared if it was
        among the ten lowest — no amount of refreshing would surface it."""
        for i in range(12):
            self._product(f'Low {i:02d}', qty=1)
        newly_low = self._product('Newly Low', qty=4, threshold=5)
        alerts = self.client.get(self.url).json()['data']['low_stock_alerts']
        ids = [a['id'] for a in alerts]
        self.assertIn(str(newly_low.id), ids)

    def test_alert_respects_per_product_threshold(self):
        flagged = self._product('Flagged', qty=20, threshold=25)
        fine = self._product('Fine', qty=12, threshold=5)
        ids = [a['id'] for a in self.client.get(self.url).json()['data']['low_stock_alerts']]
        self.assertIn(str(flagged.id), ids)
        self.assertNotIn(str(fine.id), ids, 'qty 12 with threshold 5 is not low')


class AdminProductUpdateTests(TestCase):
    """The edit form could not change a product's images or visibility, so a
    product created with a failed upload could not be repaired."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='a3@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.client.force_authenticate(user=self.admin)
        self.cat = StoreCategory.objects.create(name='Wellness', slug='wellness')
        self.product = Product.objects.create(
            name='Editable', slug='editable', description='x', category=self.cat,
            price=Decimal('10.00'), quantity_available=5, images=[],
        )
        self.url = reverse('dashboard:admin-product-detail', args=[self.product.id])

    def test_images_can_be_set(self):
        res = self.client.patch(self.url, {'images': ['https://cdn/a.png', 'https://cdn/b.png']}, format='json')
        self.assertEqual(res.status_code, 200)
        self.product.refresh_from_db()
        self.assertEqual(self.product.images, ['https://cdn/a.png', 'https://cdn/b.png'])

    def test_images_can_be_cleared(self):
        self.product.images = ['https://cdn/old.png']
        self.product.save()
        self.client.patch(self.url, {'images': []}, format='json')
        self.product.refresh_from_db()
        self.assertEqual(self.product.images, [])

    def test_blank_entries_are_dropped(self):
        self.client.patch(self.url, {'images': ['https://cdn/a.png', '', '   ']}, format='json')
        self.product.refresh_from_db()
        self.assertEqual(self.product.images, ['https://cdn/a.png'])

    def test_non_list_images_is_rejected(self):
        res = self.client.patch(self.url, {'images': 'not-a-list'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_visibility_can_be_toggled(self):
        self.client.patch(self.url, {'is_active': False}, format='json')
        self.product.refresh_from_db()
        self.assertFalse(self.product.is_active)

    def test_detail_returns_images_and_variants_for_the_form(self):
        self.product.images = ['https://cdn/a.png']
        self.product.save()
        data = self.client.get(self.url).json()['data']
        self.assertEqual(data['images'], ['https://cdn/a.png'])
        self.assertIn('variants', data)
        self.assertIn('is_active', data)
