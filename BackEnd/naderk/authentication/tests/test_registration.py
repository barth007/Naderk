"""Patient sign-up and the emailed one-time code that activates the account."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core import mail
from django.utils import timezone

from naderk.authentication.models import OTPVerification
from naderk.authentication.tests.helpers import (
    RESEND_OTP, VERIFY_OTP, emailed_code, login, register,
)
from naderk.common.email.exceptions import EmailProviderError
from naderk.core.models import User
from naderk.users.models import PatientProfile

pytestmark = pytest.mark.django_db


def verify(client, code, email='ada@naderk.test'):
    return client.post(VERIFY_OTP, {'email': email, 'code': code}, format='json')


# ── Registering ──────────────────────────────────────────────────────────────

def test_registering_creates_an_unverified_patient_and_emails_a_code(api_client):
    res = register(api_client)

    assert res.status_code == 201, res.content
    assert res.json()['data'] == {'email': 'ada@naderk.test', 'otp_required': True}
    user = User.objects.get(email='ada@naderk.test')
    assert (user.role, user.otp_verified, user.is_verified) == (User.Role.PATIENT, False, False)
    assert (user.first_name, user.last_name) == ('Ada', 'Lovelace')
    assert mail.outbox[-1].to == ['ada@naderk.test']
    assert len(emailed_code()) == 6


def test_registering_creates_the_patient_profile(api_client):
    register(api_client)

    assert PatientProfile.objects.filter(user__email='ada@naderk.test').exists()


def test_the_code_is_stored_hashed(api_client):
    register(api_client)

    assert emailed_code() not in OTPVerification.objects.get().otp_code


def test_role_cannot_be_chosen_at_sign_up(api_client):
    api_client.post('/api/v1/auth/register/', {
        'email': 'ada@naderk.test', 'password': 'a-long-password-1', 'full_name': 'Ada',
        'role': 'ADMIN', 'is_staff': True, 'is_superuser': True,
    }, format='json')

    user = User.objects.get(email='ada@naderk.test')
    assert (user.role, user.is_staff, user.is_superuser) == (User.Role.PATIENT, False, False)


def test_duplicate_email_is_rejected(api_client):
    register(api_client)

    res = register(api_client)

    assert res.status_code == 400
    assert 'email' in res.json()['errors']
    assert User.objects.filter(email='ada@naderk.test').count() == 1


@pytest.mark.parametrize('field, value', [
    ('email', 'not-an-email'), ('password', 'short'), ('full_name', ''),
])
def test_invalid_input_is_rejected_per_field(api_client, field, value):
    body = {'email': 'ada@naderk.test', 'password': 'a-long-password-1', 'full_name': 'Ada', field: value}

    res = api_client.post('/api/v1/auth/register/', body, format='json')

    assert res.status_code == 400
    assert field in res.json()['errors']
    assert not User.objects.exists()


def test_failed_email_leaves_no_half_made_account(api_client):
    """Otherwise the address is taken by an account nobody can ever verify."""
    with patch('naderk.common.email.providers.smtp.SMTPProvider.send', side_effect=EmailProviderError('down')):
        res = register(api_client)

    assert res.status_code == 400
    assert not User.objects.exists()
    assert not OTPVerification.objects.exists()


def test_registration_skips_the_code_when_otp_is_disabled(api_client, settings):
    settings.DISABLE_OTP_VERIFICATION = True

    res = register(api_client)

    assert res.json()['data']['otp_required'] is False
    assert mail.outbox == []
    assert login(api_client).status_code == 200


# ── Verifying the code ───────────────────────────────────────────────────────

def test_correct_code_verifies_the_account_and_signs_in(api_client):
    register(api_client)

    res = verify(api_client, emailed_code())

    assert res.status_code == 200, res.content
    data = res.json()['data']
    assert data['access'] and data['refresh']
    assert data['user']['role'] == 'PATIENT'
    assert User.objects.get(email='ada@naderk.test').otp_verified is True


def test_wrong_code_is_rejected(api_client):
    register(api_client)
    wrong = '000000' if emailed_code() != '000000' else '111111'

    res = verify(api_client, wrong)

    assert res.status_code == 400
    assert User.objects.get(email='ada@naderk.test').otp_verified is False


def test_a_code_works_only_once(api_client):
    register(api_client)
    code = emailed_code()
    verify(api_client, code)

    assert verify(api_client, code).status_code == 400


def test_expired_code_is_rejected(api_client):
    register(api_client)
    OTPVerification.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

    assert verify(api_client, emailed_code()).status_code == 400


def test_unknown_email_gets_the_same_refusal_as_a_wrong_code(api_client):
    res = verify(api_client, '123456', email='nobody@naderk.test')

    assert res.status_code == 400
    assert 'errors' not in res.json()


# ── Asking for a new code ────────────────────────────────────────────────────

def test_resending_replaces_the_previous_code(api_client):
    register(api_client)
    first = emailed_code()

    res = api_client.post(RESEND_OTP, {'email': 'ada@naderk.test'}, format='json')
    second = emailed_code()

    assert res.status_code == 200
    assert OTPVerification.objects.filter(is_used=False).count() == 1
    if first != second:                       # one-in-a-million they match
        assert verify(api_client, first).status_code == 400
    assert verify(api_client, second).status_code == 200


def test_resend_does_not_reveal_whether_the_email_exists(api_client):
    register(api_client)
    known = api_client.post(RESEND_OTP, {'email': 'ada@naderk.test'}, format='json')
    unknown = api_client.post(RESEND_OTP, {'email': 'nobody@naderk.test'}, format='json')

    assert (known.status_code, known.json()) == (unknown.status_code, unknown.json())
