import datetime
from django.test import TestCase
from django.utils import timezone

from naderk.core.models import User
from naderk.users.models import DoctorProfile
from .models import MedicalService, Appointment
from .tasks import mark_missed_appointments, cancel_abandoned_unpaid_appointments


class AppointmentLifecycleSweepTests(TestCase):
    def setUp(self):
        self.patient = User.objects.create_user(email='p@x.com', password='pw12345!')
        self.doctor = User.objects.create_user(email='d@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.service = MedicalService.objects.create(
            name='GP Consult', slug='gp', requires_doctor=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )
        self.yesterday = timezone.now().date() - datetime.timedelta(days=1)

    def _appt(self, **over):
        data = dict(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=self.yesterday, appointment_time=datetime.time(10, 0),
            status=Appointment.Status.CONFIRMED,
            payment_status=Appointment.PaymentStatus.PAID,
            consultation_fee=8500,
        )
        data.update(over)
        return Appointment.objects.create(**data)

    # ── missed sweep ────────────────────────────────────────────────────────
    def test_past_confirmed_becomes_no_show(self):
        a = self._appt()
        mark_missed_appointments()
        a.refresh_from_db()
        self.assertEqual(a.status, Appointment.Status.NO_SHOW)

    def test_past_paid_but_still_pending_becomes_no_show(self):
        """Paid appointments never confirmed by staff used to sit at Pending
        forever once the date passed — in billing and for the patient."""
        a = self._appt(status=Appointment.Status.PENDING)
        mark_missed_appointments()
        a.refresh_from_db()
        self.assertEqual(a.status, Appointment.Status.NO_SHOW)

    def test_future_appointment_untouched(self):
        a = self._appt(appointment_date=timezone.now().date() + datetime.timedelta(days=2))
        mark_missed_appointments()
        a.refresh_from_db()
        self.assertEqual(a.status, Appointment.Status.CONFIRMED)

    def test_unpaid_pending_is_not_marked_missed(self):
        """An abandoned checkout is not a missed visit; the other sweep owns it."""
        a = self._appt(status=Appointment.Status.PENDING,
                       payment_status=Appointment.PaymentStatus.PENDING)
        mark_missed_appointments()
        a.refresh_from_db()
        self.assertNotEqual(a.status, Appointment.Status.NO_SHOW)

    # ── abandoned-checkout sweep ────────────────────────────────────────────
    def test_stale_unpaid_appointment_is_cancelled(self):
        a = self._appt(status=Appointment.Status.PENDING,
                       payment_status=Appointment.PaymentStatus.PENDING,
                       appointment_date=timezone.now().date() + datetime.timedelta(days=3))
        Appointment.objects.filter(pk=a.pk).update(
            created_at=timezone.now() - datetime.timedelta(hours=2))
        cancel_abandoned_unpaid_appointments()
        a.refresh_from_db()
        self.assertEqual(a.status, Appointment.Status.CANCELLED)
        self.assertIn('Payment', a.cancellation_reason)

    def test_recent_unpaid_appointment_is_left_alone(self):
        """A checkout still in progress must not be swept out from under them."""
        a = self._appt(status=Appointment.Status.PENDING,
                       payment_status=Appointment.PaymentStatus.PENDING,
                       appointment_date=timezone.now().date() + datetime.timedelta(days=3))
        cancel_abandoned_unpaid_appointments()
        a.refresh_from_db()
        self.assertEqual(a.status, Appointment.Status.PENDING)

    def test_paid_appointment_is_never_cancelled_by_the_sweep(self):
        a = self._appt(status=Appointment.Status.PENDING,
                       appointment_date=timezone.now().date() + datetime.timedelta(days=3))
        Appointment.objects.filter(pk=a.pk).update(
            created_at=timezone.now() - datetime.timedelta(hours=5))
        cancel_abandoned_unpaid_appointments()
        a.refresh_from_db()
        self.assertEqual(a.status, Appointment.Status.PENDING)

    def test_free_appointment_is_never_cancelled_by_the_sweep(self):
        a = self._appt(status=Appointment.Status.PENDING,
                       payment_status=Appointment.PaymentStatus.PENDING,
                       consultation_fee=0,
                       appointment_date=timezone.now().date() + datetime.timedelta(days=3))
        Appointment.objects.filter(pk=a.pk).update(
            created_at=timezone.now() - datetime.timedelta(hours=5))
        cancel_abandoned_unpaid_appointments()
        a.refresh_from_db()
        self.assertEqual(a.status, Appointment.Status.PENDING)


class UnpaidCheckoutQuerySetTests(TestCase):
    """The single definition of 'this row is an abandoned checkout, not a
    booking'. It was previously copy-pasted into five queries across three
    modules, and one copy drifted — the doctor's calendar showed rows every
    other widget hid."""

    def setUp(self):
        from naderk.users.models import DoctorProfile
        self.patient = User.objects.create_user(email='q-p@x.com', password='pw12345!')
        self.doctor = User.objects.create_user(email='q-d@x.com', password='pw12345!', role=User.Role.DOCTOR)
        DoctorProfile.objects.filter(user=self.doctor).update(specialization='GENERAL_PRACTITIONER')
        self.service = MedicalService.objects.create(
            name='Q Consult', slug='q-consult', requires_doctor=True,
            required_specialization='GENERAL_PRACTITIONER', fee=8500,
        )

    def _appt(self, **over):
        data = dict(
            patient=self.patient, doctor=self.doctor, service=self.service,
            appointment_date=timezone.now().date() + datetime.timedelta(days=1),
            appointment_time=datetime.time(9, 0),
            status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PENDING,
            consultation_fee=8500,
        )
        data.update(over)
        return Appointment.objects.create(**data)

    def test_unpaid_pending_with_fee_is_an_abandoned_checkout(self):
        a = self._appt()
        self.assertIn(a, Appointment.objects.unpaid_checkouts())
        self.assertNotIn(a, Appointment.objects.exclude_unpaid_checkouts())

    def test_paid_pending_is_a_real_booking(self):
        a = self._appt(payment_status=Appointment.PaymentStatus.PAID)
        self.assertNotIn(a, Appointment.objects.unpaid_checkouts())
        self.assertIn(a, Appointment.objects.exclude_unpaid_checkouts())

    def test_free_appointment_is_a_real_booking(self):
        """A zero-fee appointment never goes through payment at all."""
        a = self._appt(consultation_fee=0)
        self.assertIn(a, Appointment.objects.exclude_unpaid_checkouts())

    def test_confirmed_is_a_real_booking_regardless_of_payment_field(self):
        a = self._appt(status=Appointment.Status.CONFIRMED)
        self.assertIn(a, Appointment.objects.exclude_unpaid_checkouts())

    def test_the_two_methods_partition_the_table(self):
        """Every row is in exactly one of the two sets — no gaps, no overlap."""
        self._appt()
        self._appt(payment_status=Appointment.PaymentStatus.PAID, appointment_time=datetime.time(10, 0))
        self._appt(consultation_fee=0, appointment_time=datetime.time(11, 0))
        self._appt(status=Appointment.Status.CANCELLED, appointment_time=datetime.time(12, 0))

        total = Appointment.objects.count()
        unpaid = Appointment.objects.unpaid_checkouts().count()
        real = Appointment.objects.exclude_unpaid_checkouts().count()
        self.assertEqual(unpaid + real, total)
        overlap = set(Appointment.objects.unpaid_checkouts().values_list('id', flat=True)) & \
                  set(Appointment.objects.exclude_unpaid_checkouts().values_list('id', flat=True))
        self.assertEqual(overlap, set())

    def test_chains_with_other_filters(self):
        """Used mid-chain in every call site, so it must compose."""
        self._appt()
        good = self._appt(payment_status=Appointment.PaymentStatus.PAID, appointment_time=datetime.time(10, 0))
        qs = (Appointment.objects.filter(doctor=self.doctor)
              .exclude_unpaid_checkouts()
              .order_by('appointment_time'))
        self.assertEqual(list(qs), [good])
