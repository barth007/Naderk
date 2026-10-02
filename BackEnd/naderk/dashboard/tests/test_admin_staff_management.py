"""Staff accounts, departments, the weekly rota view and role permissions."""
import datetime
import re
from unittest.mock import patch

import pytest
from django.core import mail
from django.utils import timezone

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.authentication.models import PasswordResetToken
from naderk.common.email.exceptions import EmailProviderError
from naderk.core.models import User
from naderk.users.models import Department, RolePermissionConfig
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

BASE = '/api/v1/dashboard/admin/'
STAFF = BASE + 'staff/'
DEPARTMENTS = BASE + 'departments/'
PERMISSIONS = BASE + 'permissions/'


@pytest.fixture
def admin(admin_user):
    return client_for(admin_user)


def invite(client, **body):
    body = {'first_name': 'Sam', 'last_name': 'Agent', 'email': 'sam@naderk.test', 'role': 'AGENT', **body}
    return client.post(STAFF, body, format='json')


# ── Inviting staff ───────────────────────────────────────────────────────────

def test_inviting_staff_creates_an_account_with_no_password_and_emails_a_link(admin, api_client):
    res = invite(admin, department='Support', phone_number='0800')

    assert res.status_code == 201, res.content
    user = User.objects.get(email='sam@naderk.test')
    assert (user.role, user.has_usable_password(), user.otp_verified) == ('AGENT', False, True)
    assert user.staff_profile.department == 'Support'
    assert mail.outbox[-1].to == ['sam@naderk.test']

    # The emailed link sets their password, after which they can sign in.
    token = re.search(r'reset-password\?token=([\w-]+)', mail.outbox[-1].body).group(1)
    api_client.post('/api/v1/auth/reset-password/', {
        'token': token, 'new_password': 'a-long-password-1', 'confirm_password': 'a-long-password-1'}, format='json')
    login = api_client.post('/api/v1/auth/login/', {'email': 'sam@naderk.test', 'password': 'a-long-password-1'}, format='json')
    assert login.status_code == 200
    assert login.json()['data']['user']['areas'] == ['appointments', 'messaging']


def test_the_invite_link_lasts_a_day(admin):
    invite(admin)

    remaining = PasswordResetToken.objects.get().expires_at - timezone.now()
    assert datetime.timedelta(hours=23) < remaining <= datetime.timedelta(hours=24)


def test_email_addresses_are_normalised_and_unique(admin):
    invite(admin, email='  SAM@Naderk.Test ')

    assert User.objects.filter(email='sam@naderk.test').exists()
    assert invite(admin, email='sam@naderk.test').status_code == 400


@pytest.mark.parametrize('body', [{'first_name': ''}, {'email': ''}, {'role': ''}, {'role': 'PATIENT'}, {'role': 'SUPER_ADMIN'}])
def test_invite_validation(admin, body):
    assert invite(admin, **body).status_code == 400
    assert not User.objects.filter(email='sam@naderk.test').exists()


def test_a_failed_invite_email_leaves_no_account_behind(admin):
    with patch('naderk.common.email.providers.smtp.SMTPProvider.send', side_effect=EmailProviderError('down')):
        res = invite(admin)

    assert res.status_code == 400
    assert not User.objects.filter(email='sam@naderk.test').exists()
    assert not PasswordResetToken.objects.exists()


@pytest.mark.parametrize('role', [User.Role.PATIENT, User.Role.DOCTOR, User.Role.MEDICAL_AGENT, User.Role.OPERATIONS_MANAGER])
def test_staff_management_is_for_admins_only(role):
    client = client_for(make_user('x@naderk.test', role=role))

    assert client.get(STAFF).status_code == 403
    assert invite(client).status_code == 403
    assert client.get(DEPARTMENTS).status_code == 403
    assert client.get(PERMISSIONS).status_code == 403
    assert client.post(PERMISSIONS, {'role': 'AGENT', 'permissions': []}, format='json').status_code == 403


# ── Deactivating ─────────────────────────────────────────────────────────────

def test_a_deactivated_account_can_no_longer_use_the_api(admin, api_client):
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)
    as_agent = client_for(agent)
    token = api_client.post('/api/v1/auth/login/', {'email': agent.email, 'password': 'pw12345!'}, format='json').json()['data']['access']

    res = admin.post(f'{STAFF}{agent.id}/toggle/')

    assert res.json()['data']['is_active'] is False
    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
    assert api_client.get('/api/v1/auth/me/').status_code == 401

    assert admin.post(f'{STAFF}{agent.id}/toggle/').json()['data']['is_active'] is True
    assert as_agent.get('/api/v1/auth/me/').status_code == 200


def test_toggling_an_unknown_user_is_404(admin):
    assert admin.post(f'{STAFF}00000000-0000-0000-0000-000000000000/toggle/').status_code == 404


@pytest.mark.xfail(strict=True, reason=(
    'AdminStaffToggleAPI deactivates whichever user id it is given, so an ADMIN can switch off a '
    'SUPER_ADMIN, or their own account, and lock the organisation out.'
))
def test_an_admin_cannot_deactivate_a_super_admin_or_themselves(admin, admin_user):
    owner = make_user('owner@naderk.test', role=User.Role.SUPER_ADMIN)

    assert admin.post(f'{STAFF}{owner.id}/toggle/').status_code in (400, 403)
    assert admin.post(f'{STAFF}{admin_user.id}/toggle/').status_code in (400, 403)


# ── Weekly rota ──────────────────────────────────────────────────────────────

def test_week_schedule_summarises_this_weeks_bookings(admin, patient, other_patient, doctor):
    service = factories.service()
    factories.appointment(patient, service, doctor, paid=True, days_ahead=0, status=Appointment.Status.CONFIRMED)
    factories.appointment(other_patient, service, doctor, paid=True, days_ahead=0,
                          time=datetime.time(14, 0), status=Appointment.Status.CANCELLED)

    data = admin.get(STAFF + 'schedule/').json()['data']

    today = timezone.localdate().isoformat()
    by_date = {day['date']: day for day in data['schedule']}
    assert len(data['schedule']) == 7 and data['schedule'][0]['weekday'] == 'Mon'
    assert (by_date[today]['staff_count'], by_date[today]['doctor_ids']) == (1, [str(doctor.id)])
    assert (data['summary']['doctors'], data['summary']['on_duty_doctors'], data['summary']['availability_pct']) == (1, 1, 100)


def test_week_schedule_with_no_doctors_does_not_divide_by_zero(admin):
    summary = admin.get(STAFF + 'schedule/').json()['data']['summary']

    assert (summary['doctors'], summary['availability_pct']) == (0, 0)


# ── Departments ──────────────────────────────────────────────────────────────

def department_names(admin):
    return [d['name'] for d in admin.get(DEPARTMENTS).json()['data']]


def test_department_lifecycle(admin):
    created = admin.post(DEPARTMENTS, {'name': 'Low Vision Clinic', 'description': 'Aids'}, format='json')
    pk = created.json()['data']['id']

    assert created.status_code == 201
    assert admin.post(DEPARTMENTS, {'name': 'low vision clinic'}, format='json').status_code == 400   # duplicate
    assert admin.post(DEPARTMENTS, {'name': ' '}, format='json').status_code == 400
    assert admin.patch(f'{DEPARTMENTS}{pk}/', {'name': 'Low Vision Service'}, format='json').status_code == 200
    assert 'Low Vision Service' in department_names(admin)

    assert admin.delete(f'{DEPARTMENTS}{pk}/').status_code == 200
    assert 'Low Vision Service' not in department_names(admin)
    assert Department.objects.get(pk=pk).is_active is False            # kept for history
    missing = f'{DEPARTMENTS}00000000-0000-0000-0000-000000000000/'
    assert admin.patch(missing, {'name': 'x'}, format='json').status_code == 404
    assert admin.delete(missing).status_code == 404


@pytest.mark.xfail(strict=True, reason=(
    'Removing a department only hides it; the duplicate-name check still sees the hidden row, so the '
    'same name can never be created again and the hidden one cannot be restored from the UI.'
))
def test_a_removed_departments_name_can_be_used_again(admin):
    pk = admin.post(DEPARTMENTS, {'name': 'Low Vision Clinic'}, format='json').json()['data']['id']
    admin.delete(f'{DEPARTMENTS}{pk}/')

    assert admin.post(DEPARTMENTS, {'name': 'Low Vision Clinic'}, format='json').status_code == 201


# ── Role permissions ─────────────────────────────────────────────────────────

def test_permissions_page_shows_each_editable_roles_effective_areas(admin):
    data = admin.get(PERMISSIONS).json()['data']

    assert data['manageable_roles'] == ['MEDICAL_AGENT', 'OPERATIONS_MANAGER', 'AGENT']
    by_role = {row['role']: row['permissions'] for row in data['role_permissions']}
    assert by_role['AGENT'] == ['appointments', 'messaging']
    assert {area['key'] for area in data['system_permissions']} >= {'billing', 'inventory'}


def test_saving_permissions_takes_effect_immediately(admin):
    agent = client_for(make_user('agent@naderk.test', role=User.Role.AGENT))
    assert agent.get(BASE + 'orders/').status_code == 403

    res = admin.post(PERMISSIONS, {'role': 'AGENT', 'permissions': ['orders', 'made-up-area']}, format='json')

    assert res.json()['data']['permissions'] == ['orders']
    assert agent.get(BASE + 'orders/').status_code == 200
    assert agent.get(BASE + 'appointments/requests/').status_code == 403        # no longer granted
    assert RolePermissionConfig.objects.get(role='AGENT').permissions == ['orders']


@pytest.mark.parametrize('role', ['ADMIN', 'SUPER_ADMIN', 'DOCTOR', 'PATIENT', ''])
def test_only_the_three_staff_roles_can_be_edited(admin, role):
    res = admin.post(PERMISSIONS, {'role': role, 'permissions': []}, format='json')

    assert res.status_code == 400
    assert not RolePermissionConfig.objects.exists()
