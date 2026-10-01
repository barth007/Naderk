from django.test import TestCase
from rest_framework.test import APIClient
from naderk.core.models import User


class LensCatalogueAdminTests(TestCase):
    """
    Lens types and options had no write path anywhere — GET-only endpoints, no
    Django admin registration for ecommerce, no seeder — so the catalogue could
    only be changed by inserting rows into the database.
    """

    def setUp(self):
        from naderk.ecommerce.models import LensType, LensOption
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='lensadmin@x.com', password='pw12345!', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)
        self.lens_type = LensType.objects.create(
            name='Single Vision', description='Standard.', price_modifier='0.00'
        )
        self.lens_option = LensOption.objects.create(
            name='UV Protection', price_modifier='800.00'
        )

    def test_create_and_edit_lens_type(self):
        res = self.client.post('/api/v1/dashboard/admin/lens-types/', {
            'name': 'Progressive', 'description': 'Varifocal.', 'price_modifier': '40000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        new_id = res.json()['data']['id']

        res = self.client.patch(f'/api/v1/dashboard/admin/lens-types/{new_id}/', {
            'price_modifier': '45000.00', 'is_active': False,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['price_modifier'], '45000.00')
        self.assertFalse(res.json()['data']['is_active'])

    def test_admin_list_includes_inactive(self):
        from naderk.ecommerce.models import LensType
        LensType.objects.create(name='Retired', description='', price_modifier='0', is_active=False)

        res = self.client.get('/api/v1/dashboard/admin/lens-types/')
        names = {r['name'] for r in res.json()['data']}
        self.assertIn('Retired', names)

    def test_duplicate_name_rejected(self):
        res = self.client.post('/api/v1/dashboard/admin/lens-types/',
                               {'name': 'single vision'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_negative_price_rejected(self):
        res = self.client.post('/api/v1/dashboard/admin/lens-options/',
                               {'name': 'Bad', 'price_modifier': '-1'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_cannot_delete_lens_type_used_by_an_order(self):
        from decimal import Decimal
        from naderk.ecommerce.models import Order, OrderItem
        order = Order.objects.create(
            user=self.admin, status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PAID,
            total_price=Decimal('1000.00'), shipping_address='x',
        )
        OrderItem.objects.create(order=order, lens_type=self.lens_type,
                                 quantity=1, price=Decimal('1000.00'))

        res = self.client.delete(f'/api/v1/dashboard/admin/lens-types/{self.lens_type.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Deactivate', res.json()['detail'])

    def test_cannot_delete_lens_option_used_by_an_order(self):
        from decimal import Decimal
        from naderk.ecommerce.models import Order, OrderItem
        order = Order.objects.create(
            user=self.admin, status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PAID,
            total_price=Decimal('1000.00'), shipping_address='x',
        )
        item = OrderItem.objects.create(order=order, quantity=1, price=Decimal('1000.00'))
        item.lens_options.add(self.lens_option)

        res = self.client.delete(f'/api/v1/dashboard/admin/lens-options/{self.lens_option.id}/')
        self.assertEqual(res.status_code, 400)

    def test_unused_lens_option_can_be_deleted(self):
        res = self.client.delete(f'/api/v1/dashboard/admin/lens-options/{self.lens_option.id}/')
        self.assertEqual(res.status_code, 200)

    def test_requires_the_glass_builder_area(self):
        patient = User.objects.create_user(email='p@x.com', password='pw12345!', role=User.Role.PATIENT)
        self.client.force_authenticate(user=patient)
        res = self.client.get('/api/v1/dashboard/admin/lens-types/')
        self.assertEqual(res.status_code, 403)


class FrameLensCompatibilityAdminTests(TestCase):
    """
    FrameLensCompatibility was read by the add-to-cart validator and written
    nowhere outside tests, so a newly added frame was incompatible with every
    lens and could not be bought at all.
    """

    def setUp(self):
        from decimal import Decimal
        from naderk.ecommerce.models import Frame, LensType
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='frameadmin@x.com', password='pw12345!', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)
        self.frame = Frame.objects.create(
            name='Ariana Cat Eye', brand='Ariana', style='Cat Eye',
            material='Acetate', base_price=Decimal('50000.00'),
        )
        self.progressive = LensType.objects.create(
            name='Progressive', description='Varifocal.', price_modifier='40000.00'
        )
        self.single = LensType.objects.create(
            name='Single Vision', description='Standard.', price_modifier='0.00'
        )

    def _url(self):
        return f'/api/v1/dashboard/admin/frames/{self.frame.id}/lens-types/'

    def test_new_frame_starts_with_no_compatible_lenses(self):
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['lens_type_ids'], [])

    def test_setting_compatibility_makes_the_pair_valid(self):
        from naderk.ecommerce.models import FrameLensCompatibility

        res = self.client.put(self._url(), {
            'lens_type_ids': [str(self.progressive.id), str(self.single.id)],
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            FrameLensCompatibility.objects.filter(
                frame=self.frame, lens_type=self.progressive
            ).exists()
        )

    def test_put_replaces_rather_than_appends(self):
        from naderk.ecommerce.models import FrameLensCompatibility

        self.client.put(self._url(), {
            'lens_type_ids': [str(self.progressive.id), str(self.single.id)],
        }, format='json')
        self.client.put(self._url(), {'lens_type_ids': [str(self.single.id)]}, format='json')

        remaining = list(
            FrameLensCompatibility.objects.filter(frame=self.frame)
            .values_list('lens_type_id', flat=True)
        )
        self.assertEqual(remaining, [self.single.id])

    def test_unknown_lens_id_rejected(self):
        res = self.client.put(self._url(), {
            'lens_type_ids': ['00000000-0000-0000-0000-000000000000'],
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_frame_payload_exposes_compatibility_for_the_builder(self):
        from naderk.ecommerce.serializers import FrameSerializer

        self.client.put(self._url(), {'lens_type_ids': [str(self.single.id)]}, format='json')
        self.frame.refresh_from_db()
        data = FrameSerializer(self.frame).data
        self.assertEqual(data['compatible_lens_type_ids'], [str(self.single.id)])
