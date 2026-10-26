"""Signing in, staying signed in, and the profile the frontend boots from."""
import pytest

from naderk.authentication.models import LoginAttempt
from naderk.authentication.tests.helpers import LOGIN, ME, REFRESH, login
from naderk.core.models import User
from naderk.users.models import RolePermissionConfig
from tests.helpers import PASSWORD, client_for, make_user

pytestmark = pytest.mark.django_db


@pytest.fixture
def verified_patient():
    return make_user('ada@naderk.test', otp_verified=True, is_verified=True)


def sign_in(client, email='ada@naderk.test', password=PASSWORD):
    return login(client, email=email, password=password)


def test_correct_credentials_return_tokens_and_the_user(api_client, verified_patient):
    res = sign_in(api_client)

    assert res.status_code == 200, res.content
    data = res.json()['data']
    assert data['access'] and data['refresh']
    assert data['user']['email'] == 'ada@naderk.test'
    assert data['user']['areas'] == []


def test_the_access_token_authenticates_requests(api_client, verified_patient):
    access = sign_in(api_client).json()['data']['access']

    api_client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    assert api_client.get(ME).json()['data']['email'] == 'ada@naderk.test'


@pytest.mark.parametrize('email, password', [
    ('ada@naderk.test', 'wrong-password'),
    ('nobody@naderk.test', PASSWORD),
])
def test_bad_credentials_get_one_indistinguishable_refusal(api_client, verified_patient, email, password):
    res = sign_in(api_client, email, password)

    assert res.status_code == 401
    assert res.json()['detail'] == 'Invalid credentials.'


@pytest.mark.parametrize('body', [{}, {'email': 'ada@naderk.test'}, {'password': PASSWORD}])
def test_missing_fields_are_a_validation_error(api_client, body):
    assert api_client.post('/api/v1/auth/login/', body, format='json').status_code == 400


def test_unverified_patient_cannot_sign_in(api_client):
    make_user('ada@naderk.test')          # registered, code never entered

    res = sign_in(api_client)

    assert res.status_code == 401
    assert 'verify' in res.json()['detail'].lower()


@pytest.mark.parametrize('role', [User.Role.DOCTOR, User.Role.AGENT, User.Role.ADMIN])
def test_staff_sign_in_without_a_code(api_client, role):
    """Staff accounts are created by an admin, never through sign-up."""
    make_user('staff@naderk.test', role=role)

    assert sign_in(api_client, 'staff@naderk.test').status_code == 200


def test_every_attempt_is_recorded(api_client, verified_patient):
    sign_in(api_client, password='wrong-password')
    sign_in(api_client, 'nobody@naderk.test')
    sign_in(api_client)

    outcomes = list(LoginAttempt.objects.order_by('attempted_at').values_list('email', 'is_successful'))
    assert outcomes == [
        ('ada@naderk.test', False), ('nobody@naderk.test', False), ('ada@naderk.test', True),
    ]


# ── Refresh ──────────────────────────────────────────────────────────────────

def test_refresh_token_buys_a_new_access_token(api_client, verified_patient):
    refresh = sign_in(api_client).json()['data']['refresh']

    res = api_client.post(REFRESH, {'refresh': refresh}, format='json')

    assert res.status_code == 200
    assert res.json()['access']
    assert res.json()['refresh'] != refresh      # rotated


def test_access_token_is_not_accepted_as_a_refresh_token(api_client, verified_patient):
    access = sign_in(api_client).json()['data']['access']

    assert api_client.post(REFRESH, {'refresh': access}, format='json').status_code == 401


def test_a_rotated_refresh_token_cannot_be_used_again(api_client, verified_patient):
    refresh = sign_in(api_client).json()['data']['refresh']
    api_client.post(REFRESH, {'refresh': refresh}, format='json')

    assert api_client.post(REFRESH, {'refresh': refresh}, format='json').status_code == 401


# ── /auth/me/ ────────────────────────────────────────────────────────────────

def test_me_requires_authentication(api_client):
    assert api_client.get(ME).status_code == 401


def test_me_for_a_patient(patient):
    data = client_for(patient).get(ME).json()['data']

    assert data['role'] == 'PATIENT'
    assert data['patient_id']
    assert data['permissions'] == [] and data['areas'] == []
    assert data['profile_completed'] is False


def test_me_gives_admins_every_area(admin_user):
    areas = client_for(admin_user).get(ME).json()['data']['areas']

    assert {'billing', 'staff', 'settings', 'inventory'} <= set(areas)


def test_me_reflects_an_admins_change_to_a_roles_areas():
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)
    assert client_for(agent).get(ME).json()['data']['areas'] == ['appointments', 'messaging']

    RolePermissionConfig.objects.create(role='AGENT', permissions=['messaging', 'not-a-real-area'])

    assert client_for(agent).get(ME).json()['data']['areas'] == ['messaging']


def test_sign_ins_are_rate_limited_even_when_the_forwarded_for_header_changes(
    api_client, verified_patient, monkeypatch,
):
    from django.core.cache import cache
    from rest_framework.throttling import ScopedRateThrottle

    cache.clear()
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'auth_login': '2/minute'})
    try:
        # nginx appends the real client address, so only the last entry counts;
        # whatever the client puts before it must not reset the count.
        codes = [
            api_client.post(
                LOGIN,
                {'email': 'ada@naderk.test', 'password': PASSWORD},
                format='json',
                HTTP_X_FORWARDED_FOR=f'10.0.0.{n}, 203.0.113.7',
            ).status_code
            for n in range(3)
        ]
    finally:
        cache.clear()

    assert codes == [200, 200, 429]
