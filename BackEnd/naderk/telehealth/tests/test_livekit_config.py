from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from naderk.appointments.models import Appointment, MedicalService
from naderk.telehealth.models import TelehealthSession

User = get_user_model()


class LiveKitConfigGuardTests(TestCase):
    """
    A LiveKit URL a remote browser cannot reach produces a blank video area with
    no error — signalling never connects and nothing says so. Fail the join
    instead of handing out a URL that cannot work.
    """

    def setUp(self):
        from decimal import Decimal
        from rest_framework.test import APIClient
        from django.contrib.auth import get_user_model
        from naderk.appointments.models import Appointment, MedicalService
        from naderk.telehealth.models import TelehealthSession

        User = get_user_model()
        self.patient = User.objects.create_user(email='lk-pat@x.com', password='pw12345!', role='PATIENT')
        self.doctor = User.objects.create_user(email='lk-doc@x.com', password='pw12345!', role='DOCTOR')
        service = MedicalService.objects.create(
            name='Video Consult', slug='video-consult', description='x',
            fee=Decimal('5000.00'), requires_doctor=True,
            available_online=True, duration_minutes=30,
        )
        appt = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, service=service,
            appointment_date=timezone.localdate(), appointment_time=timezone.localtime().time(),
            status=Appointment.Status.CONFIRMED, consultation_fee=Decimal('5000.00'),
            payment_status=Appointment.PaymentStatus.PAID,
            appointment_type=Appointment.AppointmentType.TELEHEALTH,
        )
        # A signal creates the session when the appointment is confirmed, so
        # creating one here would collide on the appointment's unique key.
        self.session = TelehealthSession.objects.get(appointment=appt)
        self.client = APIClient()
        self.client.force_authenticate(user=self.patient)

    def _join(self):
        return self.client.post(f'/api/v1/telehealth/sessions/{self.session.id}/join/')

    def test_localhost_is_allowed_in_debug(self):
        with self.settings(DEBUG=True, LIVEKIT_URL='http://localhost:7880'):
            res = self._join()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['server_url'], 'ws://localhost:7880')

    def test_localhost_is_refused_outside_debug(self):
        with self.settings(DEBUG=False, LIVEKIT_URL='http://localhost:7880'):
            res = self._join()
        self.assertEqual(res.status_code, 503)

    def test_insecure_ws_is_refused_outside_debug(self):
        """Browsers block ws:// from an https page, so the call silently never connects."""
        with self.settings(DEBUG=False, LIVEKIT_URL='http://livekit.example.com'):
            res = self._join()
        self.assertEqual(res.status_code, 503)

    def test_secure_remote_url_is_accepted(self):
        with self.settings(DEBUG=False, LIVEKIT_URL='https://livekit.example.com'):
            res = self._join()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['server_url'], 'wss://livekit.example.com')
