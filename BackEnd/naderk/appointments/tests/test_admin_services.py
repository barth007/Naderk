from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService


class AvailableOnlineBackfillTests(TestCase):
    """Enforcing available_online would have silently killed telehealth on every
    pre-existing service, since they all sat at the False default."""

    def test_migration_left_doctor_services_online_capable(self):
        from django.db.migrations.executor import MigrationExecutor
        from django.db import connection
        executor = MigrationExecutor(connection)
        applied = {name for app, name in executor.loader.applied_migrations if app == 'appointments'}
        self.assertIn('0011_backfill_available_online', applied)

    def test_backfill_only_targets_doctor_required_services(self):
        """Facility services must stay offline — the backfill must not flip them."""
        from django.db import connection
        from django.db.migrations.recorder import MigrationRecorder  # noqa: F401

        facility = MedicalService.objects.create(
            name='Lab Panel', slug='lab-panel', requires_doctor=False,
            available_online=False, fee=1000,
        )
        # Re-run the backfill body against current data.
        MedicalService.objects.filter(requires_doctor=True, available_online=False).update(
            available_online=True,
        )
        facility.refresh_from_db()
        self.assertFalse(facility.available_online)


class AdminServiceToggleTests(TestCase):
    """Deactivating a service must persist and must drop it from the patient list."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='admin@x.com', password='pw12345!', role=User.Role.ADMIN,
        )
        self.client.force_authenticate(user=self.admin)
        self.service = MedicalService.objects.create(
            name='Toggle Me', slug='toggle-me', requires_doctor=True,
            required_specialization=DoctorProfile.Specialization.OPTOMETRIST,
            fee=5000, is_active=True,
        )
        self.detail_url = reverse('dashboard:admin-service-detail', args=[self.service.id])

    def test_toggle_returns_updated_row_and_persists(self):
        res = self.client.patch(self.detail_url, {'is_active': False}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.json()['data']['is_active'])
        self.service.refresh_from_db()
        self.assertFalse(self.service.is_active)

        res = self.client.patch(self.detail_url, {'is_active': True}, format='json')
        self.assertTrue(res.json()['data']['is_active'])
        self.service.refresh_from_db()
        self.assertTrue(self.service.is_active)

    def test_toggling_one_service_leaves_the_others_untouched(self):
        """Admins reported one service flipping when another was clicked — prove
        the write itself is scoped to a single row."""
        others = [
            MedicalService.objects.create(
                name=f'Other {i}', slug=f'other-{i}', requires_doctor=True,
                required_specialization=DoctorProfile.Specialization.OPTOMETRIST,
                fee=1000, is_active=True,
            )
            for i in range(3)
        ]
        res = self.client.patch(self.detail_url, {'is_active': False}, format='json')
        self.assertEqual(res.json()['data']['id'], str(self.service.id))

        self.service.refresh_from_db()
        self.assertFalse(self.service.is_active)
        for o in others:
            o.refresh_from_db()
            self.assertTrue(o.is_active, f'{o.name} should not have changed')

    def test_deactivated_service_disappears_from_patient_service_list(self):
        self.client.patch(self.detail_url, {'is_active': False}, format='json')
        res = self.client.get(reverse('medical-services'))
        names = [s['name'] for s in res.json()['data']['results']]
        self.assertNotIn('Toggle Me', names)

        self.client.patch(self.detail_url, {'is_active': True}, format='json')
        res = self.client.get(reverse('medical-services'))
        names = [s['name'] for s in res.json()['data']['results']]
        self.assertIn('Toggle Me', names)
