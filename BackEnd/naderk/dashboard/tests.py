import datetime
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService, Appointment
from naderk.telehealth.models import TelehealthSession


class DoctorCalendarQueueConsistencyTests(TestCase):
    """The calendar showed a booking for today while the queue below it said
    'no patients waiting' — same doctor, same day, same screen."""

    def setUp(self):
        self.client = APIClient()
        self.doctor = User.objects.create_user(email='d@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.patient = User.objects.create_user(email='p@x.com', password='pw12345!')
        self.service = MedicalService.objects.create(
            name='GP Consult', slug='gp', requires_doctor=True, available_online=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )
        self.client.force_authenticate(user=self.doctor)
        self.today = timezone.now().date()

    def _appt(self, **over):
        data = dict(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=self.today, appointment_time=datetime.time(13, 0),
            appointment_type='TELEHEALTH', status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PAID, consultation_fee=8500,
        )
        data.update(over)
        return Appointment.objects.create(**data)

    def _calendar_ids(self):
        res = self.client.get(reverse('dashboard:doctor-calendar'))
        return {r['id'] for r in res.json()['data']}

    def _queue_ids(self):
        res = self.client.get(reverse('dashboard:doctor-appointments'))
        return {r['id'] for r in res.json()['data']}

    def test_paid_pending_appears_in_both_calendar_and_queue(self):
        a = self._appt()
        self.assertIn(str(a.id), self._calendar_ids())
        self.assertIn(str(a.id), self._queue_ids(), 'queue must not hide a paid booking the calendar shows')

    def test_confirmed_appears_in_both(self):
        a = self._appt(status=Appointment.Status.CONFIRMED)
        self.assertIn(str(a.id), self._calendar_ids())
        self.assertIn(str(a.id), self._queue_ids())

    def test_unpaid_pending_appears_in_neither(self):
        """An abandoned checkout is not a booking — the calendar used to show it."""
        a = self._appt(payment_status=Appointment.PaymentStatus.PENDING)
        self.assertNotIn(str(a.id), self._calendar_ids())
        self.assertNotIn(str(a.id), self._queue_ids())

    def test_free_pending_appears_in_both(self):
        a = self._appt(consultation_fee=0, payment_status=Appointment.PaymentStatus.PENDING)
        self.assertIn(str(a.id), self._calendar_ids())
        self.assertIn(str(a.id), self._queue_ids())

    def test_cancelled_appears_in_neither(self):
        a = self._appt(status=Appointment.Status.CANCELLED)
        self.assertNotIn(str(a.id), self._calendar_ids())
        self.assertNotIn(str(a.id), self._queue_ids())


class TelehealthSessionCreationTests(TestCase):
    """A telehealth appointment must produce a joinable session once accepted."""

    def setUp(self):
        self.client = APIClient()
        self.doctor = User.objects.create_user(email='d2@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.patient = User.objects.create_user(email='p2@x.com', password='pw12345!')
        self.service = MedicalService.objects.create(
            name='Tele Consult', slug='tele', requires_doctor=True, available_online=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )
        self.appt = Appointment.objects.create(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=timezone.now().date(), appointment_time=datetime.time(13, 0),
            appointment_type='TELEHEALTH', status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PAID, consultation_fee=8500,
        )

    def test_paid_pending_telehealth_is_surfaced_to_the_doctor_for_acceptance(self):
        self.client.force_authenticate(user=self.doctor)
        res = self.client.get(reverse('dashboard:doctor-requests'))
        ids = [r['id'] for r in res.json()['data']]
        self.assertIn(str(self.appt.id), ids)

    def test_accepting_creates_a_real_telehealth_session(self):
        self.client.force_authenticate(user=self.doctor)
        res = self.client.post(reverse('dashboard:doctor-requests-accept', args=[self.appt.id]))
        self.assertIn(res.status_code, (200, 201), res.content)
        self.appt.refresh_from_db()
        self.assertEqual(self.appt.status, Appointment.Status.CONFIRMED)
        session = TelehealthSession.objects.filter(appointment=self.appt).first()
        self.assertIsNotNone(session, 'accepting a telehealth appointment must create a session')
        self.assertEqual(self.appt.meeting_link, f'/dashboard/telehealth/{session.id}')

    def test_meeting_link_resolves_to_the_session_not_a_random_uuid(self):
        self.client.force_authenticate(user=self.doctor)
        self.client.post(reverse('dashboard:doctor-requests-accept', args=[self.appt.id]))
        self.appt.refresh_from_db()
        session_id = self.appt.meeting_link.rsplit('/', 1)[-1]
        self.assertTrue(TelehealthSession.objects.filter(id=session_id).exists())
