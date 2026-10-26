"""Forgotten-password reset by emailed link, and changing a password while signed in."""
from datetime import timedelta
from unittest.mock import patch

import pytest
from django.core import mail
from django.utils import timezone

from naderk.authentication.models import PasswordResetToken
from naderk.authentication.tests.helpers import CHANGE, FORGOT, RESET, emailed_reset_token, login
from naderk.common.email.exceptions import EmailProviderError
from naderk.common.email.models import EmailLog
from tests.helpers import PASSWORD, client_for, make_user

pytestmark = pytest.mark.django_db

NEW = 'a-brand-new-password-2'


@pytest.fixture
def user():
    return make_user('ada@naderk.test', otp_verified=True)


def forgot(client, email='ada@naderk.test'):
    return client.post(FORGOT, {'email': email}, format='json')


def reset(client, token, new=NEW, confirm=None):
    body = {'token': token, 'new_password': new, 'confirm_password': new if confirm is None else confirm}
    return client.post(RESET, body, format='json')


# ── Forgot / reset ───────────────────────────────────────────────────────────

def test_reset_link_is_emailed_and_sets_a_new_password(api_client, user):
    assert forgot(api_client).status_code == 200
    assert mail.outbox[-1].to == ['ada@naderk.test']

    res = reset(api_client, emailed_reset_token())

    assert res.status_code == 200, res.content
    assert login(api_client, password=NEW).status_code == 200
    assert login(api_client, password=PASSWORD).status_code == 401


def test_forgot_password_does_not_reveal_whether_the_email_exists(api_client, user):
    known, unknown = forgot(api_client), forgot(api_client, 'nobody@naderk.test')

    assert (known.status_code, known.json()) == (unknown.status_code, unknown.json())
    assert len(mail.outbox) == 1


def test_forgot_password_requires_an_email(api_client):
    assert api_client.post(FORGOT, {}, format='json').status_code == 400


def test_a_reset_link_works_only_once(api_client, user):
    forgot(api_client)
    token = emailed_reset_token()
    reset(api_client, token)

    assert reset(api_client, token, new='yet-another-password-3').status_code == 400
    assert login(api_client, password=NEW).status_code == 200


def test_asking_again_cancels_the_earlier_link(api_client, user):
    forgot(api_client)
    first = emailed_reset_token()
    forgot(api_client)

    assert reset(api_client, first).status_code == 400
    assert reset(api_client, emailed_reset_token()).status_code == 200


def test_expired_link_is_rejected(api_client, user):
    forgot(api_client)
    PasswordResetToken.objects.update(expires_at=timezone.now() - timedelta(seconds=1))

    assert reset(api_client, emailed_reset_token()).status_code == 400
    assert login(api_client, password=PASSWORD).status_code == 200


@pytest.mark.parametrize('body, field', [
    ({'new_password': NEW, 'confirm_password': NEW}, 'token'),
    ({'token': 'x', 'confirm_password': NEW}, 'new_password'),
    ({'token': 'x', 'new_password': NEW, 'confirm_password': 'different'}, 'confirm_password'),
    ({'token': 'made-up', 'new_password': NEW, 'confirm_password': NEW}, 'token'),
])
def test_reset_validation(api_client, body, field):
    res = api_client.post(RESET, body, format='json')

    assert res.status_code == 400
    assert field in res.json()['errors']


def test_reset_refuses_a_short_password_and_keeps_the_link_usable(api_client, user):
    forgot(api_client)
    token = emailed_reset_token()

    assert reset(api_client, token, new='short').status_code == 400
    assert reset(api_client, token).status_code == 200


def test_email_failure_is_logged_but_not_shown_to_the_caller(api_client, user):
    with patch('naderk.common.email.providers.smtp.SMTPProvider.send', side_effect=EmailProviderError('down')):
        res = forgot(api_client)

    assert res.status_code == 200
    assert EmailLog.objects.get().status == 'failed'


# ── Change password ──────────────────────────────────────────────────────────

def change(user, current=PASSWORD, new=NEW, confirm=None):
    body = {'current_password': current, 'new_password': new,
            'confirm_password': new if confirm is None else confirm}
    return client_for(user).post(CHANGE, body, format='json')


def test_change_password(api_client, user):
    assert change(user).status_code == 200

    assert login(api_client, password=NEW).status_code == 200
    assert login(api_client, password=PASSWORD).status_code == 401


def test_change_password_requires_sign_in(api_client):
    assert api_client.post(CHANGE, {}, format='json').status_code == 401


@pytest.mark.parametrize('kwargs, status', [
    ({'current': 'not-my-password'}, 401),
    ({'confirm': 'different'}, 400),
    ({'new': 'short'}, 400),
    ({'new': ''}, 400),
])
def test_change_password_refusals_leave_the_password_alone(api_client, user, kwargs, status):
    assert change(user, **kwargs).status_code == status

    assert login(api_client, password=PASSWORD).status_code == 200
