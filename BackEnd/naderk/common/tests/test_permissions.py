"""Which staff role may use which area of the admin portal."""
import pytest
from django.contrib.auth.models import AnonymousUser
from rest_framework.test import APIRequestFactory

from naderk.common import permissions as p
from naderk.core.models import User
from naderk.users.models import RolePermissionConfig
from tests.helpers import make_user

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize('role', ['ADMIN', 'SUPER_ADMIN'])
def test_admins_hold_every_area(role):
    assert p.resolved_areas_for_role(role) == set(p.ALL_AREAS)


@pytest.mark.parametrize('role, has, lacks', [
    ('MEDICAL_AGENT', p.AREA_PATIENT_RECORDS, p.AREA_BILLING),
    ('OPERATIONS_MANAGER', p.AREA_INVENTORY, p.AREA_APPOINTMENTS),
    ('AGENT', p.AREA_MESSAGING, p.AREA_INVENTORY),
])
def test_built_in_defaults(role, has, lacks):
    areas = p.resolved_areas_for_role(role)

    assert has in areas and lacks not in areas


@pytest.mark.parametrize('role', ['PATIENT', 'DOCTOR', 'OPTICIAN', None, 'NOT_A_ROLE'])
def test_roles_outside_the_admin_portal_hold_no_areas(role):
    assert p.resolved_areas_for_role(role) == set()


def test_saved_override_replaces_the_default_and_drops_unknown_areas():
    RolePermissionConfig.objects.create(role='AGENT', permissions=[p.AREA_ORDERS, 'made-up'])

    assert p.resolved_areas_for_role('AGENT') == {p.AREA_ORDERS}


def test_an_empty_override_removes_every_area():
    RolePermissionConfig.objects.create(role='AGENT', permissions=[])

    assert p.resolved_areas_for_role('AGENT') == set()


def test_admins_cannot_be_locked_out_by_an_override():
    RolePermissionConfig.objects.create(role='ADMIN', permissions=[])

    assert p.resolved_areas_for_role('ADMIN') == set(p.ALL_AREAS)


def test_anonymous_and_missing_users_hold_nothing():
    assert p.user_areas(None) == set()
    assert p.user_areas(AnonymousUser()) == set()
    assert p.user_has_area(AnonymousUser(), p.AREA_DASHBOARD) is False


def test_area_forbidden_guards_a_view():
    request = APIRequestFactory().get('/api/v1/dashboard/admin/inventory/')
    request.user = make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER)

    assert p.area_forbidden(request, p.AREA_INVENTORY) is None
    refusal = p.area_forbidden(request, p.AREA_BILLING)
    assert refusal.status_code == 403
    assert refusal.data['instance'] == '/api/v1/dashboard/admin/inventory/'


def test_catalog_and_role_map_only_name_real_areas():
    assert {entry['key'] for entry in p.AREA_CATALOG} == set(p.ALL_AREAS)
    for role, areas in p.ROLE_AREAS.items():
        assert areas <= p.ALL_AREAS, role
    assert set(p.AREA_EDITABLE_ROLES).isdisjoint({'ADMIN', 'SUPER_ADMIN'})
