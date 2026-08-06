import datetime

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from naderk.core.models import User
from naderk.users.models import DoctorProfile
from .models import MedicalService, Appointment, DoctorAvailability
from .services import DoctorAssignmentService


def _make_doctor(email, *, specialization, telehealth, accepting=True):
    """Create a doctor. A post_save signal already makes the DoctorProfile
    (defaulting to OPHTHALMOLOGIST), so update it rather than creating a second."""
    user = User.objects.create_user(
        email=email, password='pw12345!', role=User.Role.DOCTOR,
        first_name='Ada', last_name=email.split('@')[0],
    )
    DoctorProfile.objects.filter(user=user).update(
        specialization=specialization,
        is_accepting_patients=accepting,
        telehealth_enabled=telehealth,
    )
    return user


class AssignBestDoctorTelehealthTests(TestCase):
    """assign_best_doctor must not hand a telehealth booking to a doctor who
    doesn't do video calls."""

    def setUp(self):
        self.date = timezone.now().date() + datetime.timedelta(days=1)
        self.spec = DoctorProfile.Specialization.OPTOMETRIST

    def test_physical_booking_ignores_telehealth_flag(self):
        _make_doctor('offline@x.com', specialization=self.spec, telehealth=False)
        picked = DoctorAssignmentService.assign_best_doctor(self.spec, self.date)
        self.assertIsNotNone(picked)

    def test_telehealth_booking_skips_doctor_without_telehealth(self):
        _make_doctor('offline@x.com', specialization=self.spec, telehealth=False)
        picked = DoctorAssignmentService.assign_best_doctor(
            self.spec, self.date, require_telehealth=True,
        )
        self.assertIsNone(picked)

    def test_telehealth_booking_picks_telehealth_doctor(self):
        _make_doctor('offline@x.com', specialization=self.spec, telehealth=False)
        online = _make_doctor('online@x.com', specialization=self.spec, telehealth=True)
        picked = DoctorAssignmentService.assign_best_doctor(
            self.spec, self.date, require_telehealth=True,
        )
        self.assertEqual(picked, online)

    def test_weekday_availability_is_preferred_over_unscheduled_doctor(self):
        _make_doctor('nosched@x.com', specialization=self.spec, telehealth=True)
        scheduled = _make_doctor('sched@x.com', specialization=self.spec, telehealth=True)
        DoctorAvailability.objects.create(
            doctor=scheduled, weekday=self.date.weekday(),
            start_time=datetime.time(9, 0), end_time=datetime.time(17, 0),
        )
        picked = DoctorAssignmentService.assign_best_doctor(self.spec, self.date)
        self.assertEqual(picked, scheduled)


class AssignSpecialistApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.patient = User.objects.create_user(email='pat@x.com', password='pw12345!')
        self.client.force_authenticate(user=self.patient)
        self.date = (timezone.now().date() + datetime.timedelta(days=1)).isoformat()
        self.spec = DoctorProfile.Specialization.OPTOMETRIST
        self.url = reverse('assign-specialist')

    def _service(self, *, available_online):
        return MedicalService.objects.create(
            name=f'Eye Exam {available_online}', slug=f'eye-exam-{available_online}',
            requires_doctor=True, available_online=available_online,
            required_specialization=self.spec, fee=5000,
        )

    def test_telehealth_rejected_when_service_is_not_available_online(self):
        service = self._service(available_online=False)
        _make_doctor('d@x.com', specialization=self.spec, telehealth=True)
        res = self.client.post(self.url, {
            'service_id': str(service.id), 'date': self.date,
            'appointment_type': 'TELEHEALTH',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('appointment_type', res.json()['errors'])

    def test_physical_booking_on_offline_service_succeeds(self):
        service = self._service(available_online=False)
        _make_doctor('d@x.com', specialization=self.spec, telehealth=False)
        res = self.client.post(self.url, {
            'service_id': str(service.id), 'date': self.date,
            'appointment_type': 'PHYSICAL',
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertIsNotNone(res.json()['data']['doctor'])

    def test_appointment_type_defaults_to_physical_when_omitted(self):
        service = self._service(available_online=False)
        _make_doctor('d@x.com', specialization=self.spec, telehealth=False)
        res = self.client.post(self.url, {
            'service_id': str(service.id), 'date': self.date,
        }, format='json')
        self.assertEqual(res.status_code, 200)

    def test_no_telehealth_doctor_returns_actionable_404(self):
        service = self._service(available_online=True)
        _make_doctor('d@x.com', specialization=self.spec, telehealth=False)
        res = self.client.post(self.url, {
            'service_id': str(service.id), 'date': self.date,
            'appointment_type': 'TELEHEALTH',
        }, format='json')
        self.assertEqual(res.status_code, 404)
        self.assertIn('Try another date', res.json()['detail'])


class CreateAppointmentTelehealthGuardTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.patient = User.objects.create_user(email='pat2@x.com', password='pw12345!')
        self.client.force_authenticate(user=self.patient)
        self.spec = DoctorProfile.Specialization.OPTOMETRIST
        self.doctor = _make_doctor('doc2@x.com', specialization=self.spec, telehealth=True)
        self.date = timezone.now().date() + datetime.timedelta(days=1)

    def _post(self, service, appointment_type):
        return self.client.post(reverse('create-appointment'), {
            'service_id': str(service.id), 'doctor_id': str(self.doctor.id),
            'date': self.date.isoformat(), 'time': '10:00',
            'appointment_type': appointment_type,
        }, format='json')

    def test_cannot_book_telehealth_on_physical_only_service(self):
        service = MedicalService.objects.create(
            name='Physical Only', slug='physical-only', requires_doctor=True,
            available_online=False, required_specialization=self.spec, fee=5000,
        )
        res = self._post(service, 'TELEHEALTH')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Appointment.objects.count(), 0)

    def test_can_book_telehealth_on_online_service(self):
        service = MedicalService.objects.create(
            name='Online Ok', slug='online-ok', requires_doctor=True,
            available_online=True, required_specialization=self.spec, fee=5000,
        )
        res = self._post(service, 'TELEHEALTH')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Appointment.objects.count(), 1)


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

    def test_deactivated_service_disappears_from_patient_service_list(self):
        self.client.patch(self.detail_url, {'is_active': False}, format='json')
        res = self.client.get(reverse('medical-services'))
        names = [s['name'] for s in res.json()['data']['results']]
        self.assertNotIn('Toggle Me', names)

        self.client.patch(self.detail_url, {'is_active': True}, format='json')
        res = self.client.get(reverse('medical-services'))
        names = [s['name'] for s in res.json()['data']['results']]
        self.assertIn('Toggle Me', names)
