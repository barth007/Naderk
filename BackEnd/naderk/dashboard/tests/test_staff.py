from django.test import TestCase
from rest_framework.test import APIClient
from naderk.core.models import User


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


class StaffDetailEditDeleteTests(TestCase):
    """Detail, edit and delete for one staff member (AdminStaffDetailAPI)."""

    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(
            email='detailadmin@x.com', password='pw12345!', role=User.Role.ADMIN
        )
        self.client.force_authenticate(user=self.admin)
        self.agent = User.objects.create_user(
            email='detail-agent@x.com', password='pw12345!', role='AGENT',
            first_name='Ada', last_name='Obi',
        )
        self.url = f'/api/v1/dashboard/admin/staff/{self.agent.id}/'

    def test_detail_returns_profile(self):
        res = self.client.get(self.url)
        self.assertEqual(res.status_code, 200)
        data = res.json()['data']
        self.assertEqual(data['email'], 'detail-agent@x.com')
        self.assertEqual(data['first_name'], 'Ada')
        self.assertTrue(data['can_delete'])

    def test_patient_is_not_a_staff_detail(self):
        patient = User.objects.create_user(email='p@x.com', password='pw12345!', role=User.Role.PATIENT)
        res = self.client.get(f'/api/v1/dashboard/admin/staff/{patient.id}/')
        self.assertEqual(res.status_code, 404)

    def test_non_admin_is_forbidden(self):
        self.client.force_authenticate(user=self.agent)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        self.assertEqual(self.client.delete(self.url).status_code, 403)

    def test_patch_updates_name_and_department(self):
        res = self.client.patch(
            self.url,
            {'first_name': 'Adaeze', 'phone_number': '0801', 'department': 'Support'},
            format='json',
        )
        self.assertEqual(res.status_code, 200)
        self.agent.refresh_from_db()
        self.assertEqual(self.agent.first_name, 'Adaeze')
        self.assertEqual(res.json()['data']['department'], 'Support')

    def test_patch_rejects_empty_first_name(self):
        res = self.client.patch(self.url, {'first_name': '  '}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_delete_removes_user_without_history(self):
        res = self.client.delete(self.url)
        self.assertEqual(res.status_code, 200)
        self.assertFalse(User.objects.filter(id=self.agent.id).exists())

    def test_cannot_delete_self(self):
        res = self.client.delete(f'/api/v1/dashboard/admin/staff/{self.admin.id}/')
        self.assertEqual(res.status_code, 400)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    def test_cannot_delete_super_admin(self):
        sa = User.objects.create_user(email='sa@x.com', password='pw12345!', role='SUPER_ADMIN')
        res = self.client.delete(f'/api/v1/dashboard/admin/staff/{sa.id}/')
        self.assertEqual(res.status_code, 403)
        self.assertTrue(User.objects.filter(id=sa.id).exists())

    def test_delete_blocked_when_user_has_history(self):
        from unittest import mock
        from naderk.dashboard.apis import AdminStaffDetailAPI
        history = {'appointments': 2, 'telehealth_sessions': 0, 'consultations': 0, 'prescriptions': 0, 'orders': 0}
        with mock.patch.object(AdminStaffDetailAPI, '_history', staticmethod(lambda user: history)):
            res = self.client.delete(self.url)
        self.assertEqual(res.status_code, 409)
        self.assertTrue(User.objects.filter(id=self.agent.id).exists())
