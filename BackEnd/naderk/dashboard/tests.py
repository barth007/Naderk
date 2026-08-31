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


class StaffListRoleCoverageTests(TestCase):
    """
    Staff Management offered "Support Agent" and "Operations Manager" in its
    create form, the API accepted them, and then the list filtered to a separate
    hardcoded set that omitted both — so those accounts were created and
    immediately invisible.
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='staffadmin@x.com', password='pw12345!', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)

    def test_every_creatable_role_is_listed(self):
        from naderk.dashboard.apis import CREATABLE_STAFF_ROLES, STAFF_ROLES

        missing = [r for r in CREATABLE_STAFF_ROLES if r not in STAFF_ROLES]
        self.assertEqual(
            missing, [],
            f"roles can be created but never appear in the staff list: {missing}",
        )

    def test_agent_and_operations_manager_appear(self):
        User.objects.create_user(email='agent@x.com', password='pw12345!', role='AGENT')
        User.objects.create_user(email='ops@x.com', password='pw12345!', role='OPERATIONS_MANAGER')

        res = self.client.get('/api/v1/dashboard/admin/staff/')
        self.assertEqual(res.status_code, 200)

        emails = {row['email'] for row in res.json()['data']}
        self.assertIn('agent@x.com', emails)
        self.assertIn('ops@x.com', emails)

    def test_patients_are_not_listed_as_staff(self):
        User.objects.create_user(email='patient@x.com', password='pw12345!', role=User.Role.PATIENT)

        res = self.client.get('/api/v1/dashboard/admin/staff/')
        emails = {row['email'] for row in res.json()['data']}
        self.assertNotIn('patient@x.com', emails)


class LensCatalogueAdminTests(TestCase):
    """
    Lens types and options had no write path anywhere — GET-only endpoints, no
    Django admin registration for ecommerce, no seeder — so the catalogue could
    only be changed by inserting rows into the database.
    """

    def setUp(self):
        from naderk.ecommerce.models import LensType, LensOption
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='lensadmin@x.com', password='pw12345!', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)
        self.lens_type = LensType.objects.create(
            name='Single Vision', description='Standard.', price_modifier='0.00'
        )
        self.lens_option = LensOption.objects.create(
            name='UV Protection', price_modifier='800.00'
        )

    def test_create_and_edit_lens_type(self):
        res = self.client.post('/api/v1/dashboard/admin/lens-types/', {
            'name': 'Progressive', 'description': 'Varifocal.', 'price_modifier': '40000.00',
        }, format='json')
        self.assertEqual(res.status_code, 201)
        new_id = res.json()['data']['id']

        res = self.client.patch(f'/api/v1/dashboard/admin/lens-types/{new_id}/', {
            'price_modifier': '45000.00', 'is_active': False,
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['price_modifier'], '45000.00')
        self.assertFalse(res.json()['data']['is_active'])

    def test_admin_list_includes_inactive(self):
        from naderk.ecommerce.models import LensType
        LensType.objects.create(name='Retired', description='', price_modifier='0', is_active=False)

        res = self.client.get('/api/v1/dashboard/admin/lens-types/')
        names = {r['name'] for r in res.json()['data']}
        self.assertIn('Retired', names)

    def test_duplicate_name_rejected(self):
        res = self.client.post('/api/v1/dashboard/admin/lens-types/',
                               {'name': 'single vision'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_negative_price_rejected(self):
        res = self.client.post('/api/v1/dashboard/admin/lens-options/',
                               {'name': 'Bad', 'price_modifier': '-1'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_cannot_delete_lens_type_used_by_an_order(self):
        from decimal import Decimal
        from naderk.ecommerce.models import Order, OrderItem
        order = Order.objects.create(
            user=self.admin, status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PAID,
            total_price=Decimal('1000.00'), shipping_address='x',
        )
        OrderItem.objects.create(order=order, lens_type=self.lens_type,
                                 quantity=1, price=Decimal('1000.00'))

        res = self.client.delete(f'/api/v1/dashboard/admin/lens-types/{self.lens_type.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertIn('Deactivate', res.json()['detail'])

    def test_cannot_delete_lens_option_used_by_an_order(self):
        from decimal import Decimal
        from naderk.ecommerce.models import Order, OrderItem
        order = Order.objects.create(
            user=self.admin, status=Order.Status.PENDING,
            payment_status=Order.PaymentStatus.PAID,
            total_price=Decimal('1000.00'), shipping_address='x',
        )
        item = OrderItem.objects.create(order=order, quantity=1, price=Decimal('1000.00'))
        item.lens_options.add(self.lens_option)

        res = self.client.delete(f'/api/v1/dashboard/admin/lens-options/{self.lens_option.id}/')
        self.assertEqual(res.status_code, 400)

    def test_unused_lens_option_can_be_deleted(self):
        res = self.client.delete(f'/api/v1/dashboard/admin/lens-options/{self.lens_option.id}/')
        self.assertEqual(res.status_code, 200)

    def test_requires_the_glass_builder_area(self):
        patient = User.objects.create_user(email='p@x.com', password='pw12345!', role=User.Role.PATIENT)
        self.client.force_authenticate(user=patient)
        res = self.client.get('/api/v1/dashboard/admin/lens-types/')
        self.assertEqual(res.status_code, 403)


class FrameLensCompatibilityAdminTests(TestCase):
    """
    FrameLensCompatibility was read by the add-to-cart validator and written
    nowhere outside tests, so a newly added frame was incompatible with every
    lens and could not be bought at all.
    """

    def setUp(self):
        from decimal import Decimal
        from naderk.ecommerce.models import Frame, LensType
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='frameadmin@x.com', password='pw12345!', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)
        self.frame = Frame.objects.create(
            name='Ariana Cat Eye', brand='Ariana', style='Cat Eye',
            material='Acetate', base_price=Decimal('50000.00'),
        )
        self.progressive = LensType.objects.create(
            name='Progressive', description='Varifocal.', price_modifier='40000.00'
        )
        self.single = LensType.objects.create(
            name='Single Vision', description='Standard.', price_modifier='0.00'
        )

    def _url(self):
        return f'/api/v1/dashboard/admin/frames/{self.frame.id}/lens-types/'

    def test_new_frame_starts_with_no_compatible_lenses(self):
        res = self.client.get(self._url())
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['data']['lens_type_ids'], [])

    def test_setting_compatibility_makes_the_pair_valid(self):
        from naderk.ecommerce.models import FrameLensCompatibility

        res = self.client.put(self._url(), {
            'lens_type_ids': [str(self.progressive.id), str(self.single.id)],
        }, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(
            FrameLensCompatibility.objects.filter(
                frame=self.frame, lens_type=self.progressive
            ).exists()
        )

    def test_put_replaces_rather_than_appends(self):
        from naderk.ecommerce.models import FrameLensCompatibility

        self.client.put(self._url(), {
            'lens_type_ids': [str(self.progressive.id), str(self.single.id)],
        }, format='json')
        self.client.put(self._url(), {'lens_type_ids': [str(self.single.id)]}, format='json')

        remaining = list(
            FrameLensCompatibility.objects.filter(frame=self.frame)
            .values_list('lens_type_id', flat=True)
        )
        self.assertEqual(remaining, [self.single.id])

    def test_unknown_lens_id_rejected(self):
        res = self.client.put(self._url(), {
            'lens_type_ids': ['00000000-0000-0000-0000-000000000000'],
        }, format='json')
        self.assertEqual(res.status_code, 400)

    def test_frame_payload_exposes_compatibility_for_the_builder(self):
        from naderk.ecommerce.serializers import FrameSerializer

        self.client.put(self._url(), {'lens_type_ids': [str(self.single.id)]}, format='json')
        self.frame.refresh_from_db()
        data = FrameSerializer(self.frame).data
        self.assertEqual(data['compatible_lens_type_ids'], [str(self.single.id)])


class AdminQuickActionsTests(TestCase):
    """
    Three dashboard quick actions did nothing useful: two raised "coming soon"
    toasts, and "New Patient Record" linked at /admin/records/new — not a route,
    so it matched /admin/records/[id] and tried to load a patient called "new".
    """

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='qa-admin@x.com', password='pw12345!', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)

    def test_registers_a_patient(self):
        res = self.client.post('/api/v1/dashboard/admin/patients/create/', {
            'first_name': 'Walk', 'last_name': 'In',
            'email': 'walkin@example.com', 'phone_number': '+2348000000000',
        }, format='json')
        self.assertEqual(res.status_code, 201)

        created = User.objects.get(email='walkin@example.com')
        self.assertEqual(created.role, 'PATIENT')
        # Registered at the desk, so no OTP round trip is needed.
        self.assertTrue(created.otp_verified)
        # They set their own password through the invite link.
        self.assertFalse(created.has_usable_password())

    def test_duplicate_email_rejected(self):
        User.objects.create_user(email='dupe@example.com', password='pw12345!', role='PATIENT')
        res = self.client.post('/api/v1/dashboard/admin/patients/create/', {
            'first_name': 'Dupe', 'email': 'dupe@example.com',
        }, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertIn('email', res.json()['errors'])

    def test_email_is_required(self):
        res = self.client.post('/api/v1/dashboard/admin/patients/create/',
                               {'first_name': 'NoEmail'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_booking_agent_can_register_a_patient(self):
        """An agent taking a first-time caller's booking needs this too."""
        agent = User.objects.create_user(email='qa-agent@x.com', password='pw12345!', role='AGENT')
        self.client.force_authenticate(user=agent)
        res = self.client.post('/api/v1/dashboard/admin/patients/create/', {
            'first_name': 'Caller', 'email': 'caller@example.com',
        }, format='json')
        self.assertEqual(res.status_code, 201)

    def test_patient_cannot_register_patients(self):
        patient = User.objects.create_user(email='qa-pat@x.com', password='pw12345!', role='PATIENT')
        self.client.force_authenticate(user=patient)
        res = self.client.post('/api/v1/dashboard/admin/patients/create/',
                               {'first_name': 'X', 'email': 'x@example.com'}, format='json')
        self.assertEqual(res.status_code, 403)

    def test_daily_report_is_a_pdf(self):
        res = self.client.get('/api/v1/dashboard/admin/reports/daily/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'application/pdf')
        body = b''.join(res.streaming_content) if res.streaming else res.content
        self.assertTrue(body.startswith(b'%PDF-'))

    def test_report_matches_the_dashboard_summary(self):
        """Both read the same helper, so the report cannot contradict the screen."""
        from naderk.dashboard.apis import _admin_dashboard_summary

        summary = self.client.get('/api/v1/dashboard/admin/summary/')
        self.assertEqual(summary.status_code, 200)
        self.assertEqual(summary.json()['data']['stats'], _admin_dashboard_summary()['stats'])
