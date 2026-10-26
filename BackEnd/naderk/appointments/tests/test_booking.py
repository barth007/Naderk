import datetime
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService, Appointment
from naderk.appointments.tests.helpers import _make_doctor


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
