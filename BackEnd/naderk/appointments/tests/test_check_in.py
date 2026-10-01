import datetime
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from naderk.core.models import User
from naderk.appointments.models import MedicalService, Appointment


class CheckInTests(TestCase):
    """
    Check-in existed as a patient-only endpoint that no UI ever called, and no
    appointment had ever reached CHECKED_IN. The front desk is the authority —
    it can see the patient — while a patient may self check-in only near their
    slot, or "checked in" stops meaning "present".
    """

    def setUp(self):
        from django.contrib.auth import get_user_model
        from naderk.appointments.models import MedicalService
        User = get_user_model()

        self.patient = User.objects.create_user(
            email='checkin-patient@x.com', password='pw12345!', role='PATIENT'
        )
        self.agent = User.objects.create_user(
            email='checkin-agent@x.com', password='pw12345!', role='AGENT'
        )
        self.service = MedicalService.objects.create(
            name='Onsite Scan', slug='onsite-scan', description='x',
            fee=Decimal('10000.00'), requires_doctor=False, duration_minutes=30,
        )
        now = timezone.localtime()
        self.appt = Appointment.objects.create(
            patient=self.patient, service=self.service,
            appointment_date=now.date(), appointment_time=now.time(),
            status=Appointment.Status.CONFIRMED,
            consultation_fee=Decimal('10000.00'),
            payment_status=Appointment.PaymentStatus.PAID,
        )
        self.client = APIClient()

    def _url(self):
        return f'/api/v1/appointments/{self.appt.id}/check-in/'

    def test_patient_can_check_in_at_their_slot(self):
        self.client.force_authenticate(user=self.patient)
        res = self.client.post(self._url())
        self.assertEqual(res.status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.CHECKED_IN)
        self.assertIsNotNone(self.appt.checked_in_at)

    def test_patient_cannot_check_in_a_day_early(self):
        self.appt.appointment_date = timezone.localtime().date() + datetime.timedelta(days=1)
        self.appt.save(update_fields=['appointment_date'])

        self.client.force_authenticate(user=self.patient)
        res = self.client.post(self._url())
        self.assertEqual(res.status_code, 400)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.CONFIRMED)

    def test_staff_can_check_in_regardless_of_the_window(self):
        self.appt.appointment_date = timezone.localtime().date() + datetime.timedelta(days=1)
        self.appt.save(update_fields=['appointment_date'])

        self.client.force_authenticate(user=self.agent)
        res = self.client.post(self._url())
        self.assertEqual(res.status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.CHECKED_IN)

    def test_check_in_is_idempotent(self):
        self.client.force_authenticate(user=self.agent)
        self.assertEqual(self.client.post(self._url()).status_code, 200)
        self.assertEqual(self.client.post(self._url()).status_code, 200)

    def test_staff_can_undo_but_patient_cannot(self):
        self.client.force_authenticate(user=self.agent)
        self.client.post(self._url())

        self.client.force_authenticate(user=self.patient)
        self.assertEqual(self.client.delete(self._url()).status_code, 403)

        self.client.force_authenticate(user=self.agent)
        self.assertEqual(self.client.delete(self._url()).status_code, 200)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.CONFIRMED)
        self.assertIsNone(self.appt.checked_in_at)

    def test_a_pending_appointment_cannot_be_checked_in(self):
        self.appt.status = Appointment.Status.PENDING
        self.appt.save(update_fields=['status'])
        self.client.force_authenticate(user=self.agent)
        self.assertEqual(self.client.post(self._url()).status_code, 400)

    def test_paying_for_a_facility_service_confirms_it(self):
        """No doctor exists to accept an on-site booking, so payment confirms it."""
        from naderk.payments.services import confirm_appointment_payment

        pending = Appointment.objects.create(
            patient=self.patient, service=self.service,
            appointment_date=timezone.localtime().date(),
            appointment_time=timezone.localtime().time(),
            status=Appointment.Status.PENDING,
            consultation_fee=Decimal('10000.00'),
        )
        confirm_appointment_payment(appointment=pending, reference='PAY-ONSITE')
        pending.refresh_from_db()
        self.assertEqual(pending.status, Appointment.Status.CONFIRMED)

    def test_paying_for_a_doctor_service_still_awaits_acceptance(self):
        from django.contrib.auth import get_user_model
        from naderk.appointments.models import MedicalService
        from naderk.payments.services import confirm_appointment_payment
        User = get_user_model()

        doctor = User.objects.create_user(email='ci-doc@x.com', password='pw12345!', role='DOCTOR')
        consult = MedicalService.objects.create(
            name='Consult CI', slug='consult-ci', description='x',
            fee=Decimal('5000.00'), requires_doctor=True, duration_minutes=30,
        )
        appt = Appointment.objects.create(
            patient=self.patient, doctor=doctor, service=consult,
            appointment_date=timezone.localtime().date(),
            appointment_time=timezone.localtime().time(),
            status=Appointment.Status.PENDING,
            consultation_fee=Decimal('5000.00'),
        )
        confirm_appointment_payment(appointment=appt, reference='PAY-CONSULT')
        appt.refresh_from_db()
        self.assertEqual(appt.status, Appointment.Status.PENDING)
