from django.test import TestCase
from django.contrib.auth import get_user_model
from naderk.ecommerce.models import Prescription

User = get_user_model()


class PrescriptionValidateEndpointTests(TestCase):
    """
    The builder is a staged wizard, but the dioptre ranges were only enforced by
    the create call at checkout — a patient finished every stage before learning
    a value several steps back was out of range.
    """

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.patient = User.objects.create_user(
            email='rxvalidate@test.com', password='pw12345!', role='PATIENT'
        )
        self.client.force_authenticate(user=self.patient)

    def test_rejects_out_of_range_without_saving(self):
        before = Prescription.objects.count()

        res = self.client.post('/api/v1/marketplace/prescriptions/validate/', {
            'right_sph': '-25.00', 'right_cyl': '-12.00',
            'left_sph': '25.00', 'left_cyl': '11.00',
            'pupillary_distance': '63.00',
        }, format='json')

        self.assertEqual(res.status_code, 400)
        errors = res.json()['errors']
        self.assertIn('right_sph', errors)
        self.assertIn('right_cyl', errors)
        self.assertIn('left_sph', errors)
        self.assertIn('left_cyl', errors)
        # A dry run must never persist.
        self.assertEqual(Prescription.objects.count(), before)

    def test_accepts_valid_values_without_saving(self):
        before = Prescription.objects.count()

        res = self.client.post('/api/v1/marketplace/prescriptions/validate/', {
            'right_sph': '-2.00', 'right_cyl': '-0.50',
            'left_sph': '-1.75', 'left_cyl': '-0.25',
            'pupillary_distance': '63.00',
        }, format='json')

        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()['data']['valid'])
        self.assertEqual(Prescription.objects.count(), before)

    def test_agrees_with_the_create_endpoint(self):
        """Both run the same serializer, so a value one rejects the other must too."""
        payload = {
            'right_sph': '-25.00', 'pupillary_distance': '63.00',
        }
        dry = self.client.post('/api/v1/marketplace/prescriptions/validate/', payload, format='json')
        real = self.client.post('/api/v1/marketplace/prescriptions/', payload, format='json')
        self.assertEqual(dry.status_code, 400)
        self.assertEqual(real.status_code, 400)
        self.assertEqual(dry.json()['errors'].keys(), real.json()['errors'].keys())

    def test_requires_authentication(self):
        from rest_framework.test import APIClient
        res = APIClient().post('/api/v1/marketplace/prescriptions/validate/', {}, format='json')
        self.assertIn(res.status_code, (401, 403))
