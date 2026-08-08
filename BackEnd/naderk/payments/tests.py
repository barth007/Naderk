import datetime
from unittest.mock import patch
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService, Appointment
from .models import PaymentTransaction


class VerifyAppointmentPaymentTests(TestCase):
    """Confirmation used to depend solely on the Paystack webhook. A Paystack
    account has one webhook URL, so whichever environment misses out left the
    patient paying and then watching a spinner forever."""

    def setUp(self):
        self.client = APIClient()
        self.patient = User.objects.create_user(email='p@x.com', password='pw12345!')
        self.other = User.objects.create_user(email='o@x.com', password='pw12345!')
        self.client.force_authenticate(user=self.patient)
        self.doctor = User.objects.create_user(email='d@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.service = MedicalService.objects.create(
            name='GP Consult', slug='gp', requires_doctor=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )
        self.appt = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=timezone.now().date() + datetime.timedelta(days=1),
            appointment_time=datetime.time(13, 0), status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PENDING, consultation_fee=8500,
        )
        self.txn = PaymentTransaction.objects.create(
            user=self.patient, provider='PAYSTACK', reference='NDK-ABC123',
            amount_kobo=850000, appointment=self.appt,
            status=PaymentTransaction.Status.INITIATED, raw_response={},
        )
        self.url = reverse('payment-verify-appointment')

    def _ok(self, status='success'):
        return patch('naderk.payments.apis.verify_and_confirm',
                     return_value=type('R', (), {'status': status, 'metadata': {}})())

    def test_successful_verification_marks_appointment_paid(self):
        with self._ok():
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual(res.json()['data']['payment_status'], 'PAID')
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PAID)
        self.assertEqual(self.appt.payment_reference, 'NDK-ABC123')

    def test_appointment_stays_pending_for_doctor_acceptance(self):
        with self._ok():
            self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.PENDING)

    def test_verification_is_idempotent(self):
        with self._ok():
            self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['payment_status'], 'PAID')

    def test_unsuccessful_provider_status_does_not_mark_paid(self):
        with self._ok(status='failed'):
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_cannot_verify_another_users_transaction(self):
        self.client.force_authenticate(user=self.other)
        with self._ok():
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 404)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_unknown_reference_is_rejected(self):
        res = self.client.post(self.url, {'reference': 'NDK-NOPE'}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_missing_reference_is_rejected(self):
        res = self.client.post(self.url, {}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_provider_outage_returns_502_not_a_false_success(self):
        with patch('naderk.payments.apis.verify_and_confirm', side_effect=RuntimeError('boom')):
            res = self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.assertEqual(res.status_code, 502)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.payment_status, Appointment.PaymentStatus.PENDING)

    def test_paid_appointment_is_surfaced_to_the_doctor(self):
        """The whole point: after verifying, the doctor can accept it."""
        with self._ok():
            self.client.post(self.url, {'reference': 'NDK-ABC123'}, format='json')
        self.client.force_authenticate(user=self.doctor)
        res = self.client.get(reverse('dashboard:doctor-requests'))
        self.assertIn(str(self.appt.id), [r['id'] for r in res.json()['data']])
