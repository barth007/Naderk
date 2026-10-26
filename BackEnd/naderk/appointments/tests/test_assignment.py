import datetime
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService, DoctorAvailability
from naderk.appointments.services import DoctorAssignmentService
from naderk.appointments.tests.helpers import _make_doctor


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
