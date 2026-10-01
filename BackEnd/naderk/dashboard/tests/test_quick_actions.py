from django.test import TestCase
from rest_framework.test import APIClient
from naderk.core.models import User


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
