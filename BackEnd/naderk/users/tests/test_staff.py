from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from naderk.core.models import User
from naderk.users.models import DoctorProfile


class AddStaffSpecializationTests(TestCase):
    """Admin-created doctors used to silently inherit the signal default."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(email='a3@x.com', password='pw12345!', role=User.Role.ADMIN)
        self.client.force_authenticate(user=self.admin)
        self.url = reverse('dashboard:admin-staff')

    def _payload(self, **over):
        base = {'first_name': 'New', 'last_name': 'Doc', 'email': 'newdoc@x.com', 'role': 'DOCTOR'}
        base.update(over)
        return base

    def test_doctor_without_specialization_is_rejected(self):
        res = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(res.status_code, 400)
        self.assertFalse(User.objects.filter(email='newdoc@x.com').exists())

    def test_doctor_with_invalid_specialization_is_rejected(self):
        res = self.client.post(self.url, self._payload(specialization='MADE_UP'), format='json')
        self.assertEqual(res.status_code, 400)

    def test_doctor_specialization_is_applied(self):
        res = self.client.post(self.url, self._payload(specialization='OPTOMETRIST'), format='json')
        self.assertIn(res.status_code, (200, 201))
        profile = DoctorProfile.objects.get(user__email='newdoc@x.com')
        self.assertEqual(profile.specialization, 'OPTOMETRIST')

    def test_admin_created_doctor_gets_default_availability(self):
        """Otherwise they're recommended but every date shows zero slots."""
        from naderk.appointments.models import DoctorAvailability
        self.client.post(self.url, self._payload(specialization='OPTOMETRIST'), format='json')
        doctor = User.objects.get(email='newdoc@x.com')
        self.assertEqual(DoctorAvailability.objects.filter(doctor=doctor, is_active=True).count(), 5)

    def test_non_doctor_role_does_not_require_specialization(self):
        res = self.client.post(
            self.url, self._payload(role='OPTICIAN', email='newopt@x.com'), format='json',
        )
        self.assertIn(res.status_code, (200, 201))
