from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from decimal import Decimal
from naderk.ecommerce.models import StoreCategory, Product, Frame, FrameVariant

User = get_user_model()


class WishlistSerializerTests(TestCase):
    """WishlistItemSerializer declared frame_detail but left it out of
    Meta.fields, so DRF raised AssertionError -> 500 on every wishlist call.

    Standalone fixtures on purpose: subclassing EcommerceTestCase would re-run
    that class's whole suite under this name."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.patient = User.objects.create_user(
            email='wish@example.com', password='testpassword', role=User.Role.PATIENT,
        )
        self.category = StoreCategory.objects.create(name='Wish Cat', slug='wish-cat')
        self.product = Product.objects.create(
            name='Wish Product', slug='wish-product', description='x',
            category=self.category, price=Decimal('25.00'), quantity_available=20,
        )
        self.frame = Frame.objects.create(
            name='Classic Wayfarer', brand='RayBan', style='Wayfarer',
            material='Acetate', base_price=Decimal('120.00'),
        )
        self.frame_variant = FrameVariant.objects.create(
            frame=self.frame, color='Black', size='Medium',
            quantity_available=8, sku='WISH-RB-BLK-MD',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.patient)
        self.url = reverse('ecommerce:wishlist-toggle')

    def test_toggle_product_returns_200_not_500(self):
        res = self.client.post(self.url, {'product_id': str(self.product.id)}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()['data']['items']), 1)

    def test_toggle_frame_variant_exposes_frame_detail(self):
        res = self.client.post(
            self.url, {'frame_variant_id': str(self.frame_variant.id)}, format='json',
        )
        self.assertEqual(res.status_code, 200)
        item = res.json()['data']['items'][0]
        self.assertIn('frame_detail', item)
        self.assertEqual(item['frame_detail']['name'], 'Classic Wayfarer')

    def test_frame_detail_omitted_for_product_only_item(self):
        """frame_detail traverses a nullable FK (frame_variant.frame), so DRF
        drops the key rather than emitting null when the item is a plain
        product. Same shape OrderItemSerializer already produces, so clients
        must treat it as optional — asserted here so it stays deliberate."""
        res = self.client.post(self.url, {'product_id': str(self.product.id)}, format='json')
        self.assertEqual(res.status_code, 200)
        item = res.json()['data']['items'][0]
        self.assertIsNone(item.get('frame_detail'))
        self.assertIsNotNone(item['product_detail'])

    def test_toggle_twice_removes_the_item(self):
        self.client.post(self.url, {'product_id': str(self.product.id)}, format='json')
        res = self.client.post(self.url, {'product_id': str(self.product.id)}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.json()['data']['items']), 0)

    def test_wishlist_get_also_serializes(self):
        self.client.post(self.url, {'frame_variant_id': str(self.frame_variant.id)}, format='json')
        res = self.client.get(reverse('ecommerce:wishlist-detail'))
        self.assertEqual(res.status_code, 200)
