from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from naderk.appointments.models import Appointment, MedicalService

User = get_user_model()


class PatientRecordAccuracyTests(TestCase):
    """The clinical summary invented data when a patient had none: a real drug
    name as the default prescription, canned complaints, fake vitals — and
    last/next appointment were effectively unordered."""

    def setUp(self):
        from naderk.users.models import DoctorProfile
        self.doctor = User.objects.create_user(email='rec-doc@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.patient = User.objects.create_user(email='rec-pat@x.com', password='pw12345!',
                                                first_name='Pat', last_name='B')
        self.service = MedicalService.objects.create(
            name='GP Consult', slug='rec-gp', requires_doctor=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )
        self.today = timezone.now().date()

    def _appt(self, day_offset, status, **over):
        import datetime as _dt
        data = dict(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=self.today + _dt.timedelta(days=day_offset),
            appointment_time=_dt.time(13, 0), status=status,
            payment_status=Appointment.PaymentStatus.PAID, consultation_fee=8500,
        )
        data.update(over)
        return Appointment.objects.create(**data)

    def _record(self):
        from naderk.medical_records.selectors import get_doctor_patient_records
        recs = get_doctor_patient_records(user=self.doctor)
        return next(r for r in recs if r['id'] == str(self.patient.id))

    def test_no_prescription_means_no_prescription_shown(self):
        self._appt(0, Appointment.Status.PENDING)
        rec = self._record()
        self.assertIsNone(rec['current_rx'])
        self.assertIsNone(rec['previous_rx'])

    def test_no_fabricated_vitals_or_complaints(self):
        self._appt(0, Appointment.Status.PENDING)
        rec = self._record()
        self.assertIsNone(rec['weight'])
        self.assertIsNone(rec['vitals'])
        self.assertEqual(rec['complaints'], [])

    def test_first_ever_booking_has_no_last_appointment(self):
        """Only bookings for today and the future exist — nothing has happened yet."""
        self._appt(0, Appointment.Status.PENDING)
        self._appt(3, Appointment.Status.PENDING)
        rec = self._record()
        self.assertIsNone(rec['last_appointment'], 'a future booking is not a past visit')

    def test_next_appointment_is_the_soonest_not_the_furthest(self):
        self._appt(3, Appointment.Status.PENDING)
        self._appt(10, Appointment.Status.PENDING)
        rec = self._record()
        import datetime as _d
        expected = (self.today + _d.timedelta(days=3)).strftime('%b %d, %Y')
        self.assertEqual(rec['next_appointment'], expected)

    def test_last_appointment_is_the_most_recent_attended_visit(self):
        self._appt(-10, Appointment.Status.COMPLETED)
        self._appt(-2, Appointment.Status.COMPLETED)
        self._appt(5, Appointment.Status.CONFIRMED)
        rec = self._record()
        import datetime as _d
        expected = (self.today - _d.timedelta(days=2)).strftime('%b %d, %Y')
        self.assertEqual(rec['last_appointment'], expected)

    def test_cancelled_booking_is_not_counted_as_a_visit(self):
        self._appt(-4, Appointment.Status.CANCELLED)
        rec = self._record()
        self.assertIsNone(rec['last_appointment'])
