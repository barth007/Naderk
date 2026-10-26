from django.test import TestCase
from django.urls import reverse
from decimal import Decimal
from naderk.ecommerce.models import StoreCategory, Product


class ProductPaginationTests(TestCase):
    """limit/offset paging backs the storefront's infinite scroll. Callers that
    omit `limit` must still get the plain array they always got."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.category = StoreCategory.objects.create(name='Paged', slug='paged')
        for i in range(15):
            Product.objects.create(
                name=f'Paged Product {i:02d}', slug=f'paged-{i:02d}', description='x',
                category=self.category, price=Decimal('10.00'), quantity_available=5,
            )
        self.url = reverse('ecommerce:product-list')

    def test_without_limit_returns_plain_array(self):
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertIsInstance(res.json()['data'], list)
        self.assertEqual(len(res.json()['data']), 15)

    def test_first_page_reports_total_and_has_more(self):
        res = self.client.get(self.url, {'limit': 12})
        data = res.json()['data']
        self.assertEqual(len(data['results']), 12)
        self.assertEqual(data['total'], 15)
        self.assertTrue(data['has_more'])

    def test_last_page_sets_has_more_false(self):
        data = self.client.get(self.url, {'limit': 12, 'offset': 12}).json()['data']
        self.assertEqual(len(data['results']), 3)
        self.assertFalse(data['has_more'])

    def test_pages_do_not_overlap_or_skip(self):
        p1 = self.client.get(self.url, {'limit': 12, 'offset': 0}).json()['data']['results']
        p2 = self.client.get(self.url, {'limit': 12, 'offset': 12}).json()['data']['results']
        ids = [p['id'] for p in p1] + [p['id'] for p in p2]
        self.assertEqual(len(ids), len(set(ids)), 'pages overlap')
        self.assertEqual(len(ids), 15, 'pages skip rows')

    def test_limit_is_capped(self):
        data = self.client.get(self.url, {'limit': 9999}).json()['data']
        self.assertLessEqual(data['limit'], 60)

    def test_non_integer_limit_is_rejected(self):
        res = self.client.get(self.url, {'limit': 'abc'})
        self.assertEqual(res.status_code, 400)

    def test_category_filter_still_applies_when_paged(self):
        other = StoreCategory.objects.create(name='Other', slug='other-cat')
        Product.objects.create(
            name='Other Product', slug='other-product', description='x',
            category=other, price=Decimal('5.00'), quantity_available=1,
        )
        data = self.client.get(self.url, {'limit': 50, 'category_slug': 'paged'}).json()['data']
        self.assertEqual(data['total'], 15)
