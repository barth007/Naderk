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
