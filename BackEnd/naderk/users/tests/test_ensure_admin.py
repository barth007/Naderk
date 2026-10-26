"""The ensure_admin command: the way back in when nobody can log in."""
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from naderk.core.models import User
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db


def run(*args):
    out = StringIO()
    call_command('ensure_admin', *args, stdout=out)
    return out.getvalue()


def test_creates_an_admin_who_can_sign_in_straight_away(api_client):
    out = run('--email', 'Boss@Naderk.Test', '--password', 'a-long-password-1')

    user = User.objects.get(email='boss@naderk.test')
    assert 'Created admin' in out
    assert (user.role, user.is_staff, user.is_active, user.otp_verified) == ('ADMIN', True, True, True)
    assert user.profile_completion_status == 'COMPLETED'            # otherwise login bounces to onboarding
    res = api_client.post('/api/v1/auth/login/', {'email': 'boss@naderk.test', 'password': 'a-long-password-1'}, format='json')
    assert res.status_code == 200
    assert 'billing' in res.json()['data']['user']['areas']


def test_running_it_again_resets_the_password_and_repairs_the_account():
    locked = make_user('boss@naderk.test', role=User.Role.ADMIN, is_active=False)

    out = run('--email', 'boss@naderk.test', '--password', 'a-new-password-2', '--role', 'SUPER_ADMIN')

    locked.refresh_from_db()
    assert 'Reset password for existing admin' in out
    assert locked.check_password('a-new-password-2')
    assert (locked.role, locked.is_active) == ('SUPER_ADMIN', True)
    assert User.objects.filter(email='boss@naderk.test').count() == 1


def test_short_passwords_and_unknown_roles_are_refused():
    with pytest.raises(CommandError, match='at least 8'):
        run('--email', 'boss@naderk.test', '--password', 'short')
    with pytest.raises(CommandError):
        run('--email', 'boss@naderk.test', '--password', 'a-long-password-1', '--role', 'PATIENT')
    assert not User.objects.exists()


def test_prompted_passwords_must_match(monkeypatch):
    answers = iter(['a-long-password-1', 'a-different-one-2'])
    monkeypatch.setattr('getpass.getpass', lambda prompt='': next(answers))

    with pytest.raises(CommandError, match='did not match'):
        run('--email', 'boss@naderk.test')


def test_list_shows_admins_without_changing_anything(admin_user):
    unusable = make_user('invited@naderk.test', role=User.Role.SUPER_ADMIN)
    unusable.set_unusable_password()
    unusable.save()
    make_user('patient2@naderk.test')

    out = run('--list')

    assert '2 admin account(s)' in out
    assert 'admin@naderk.test' in out and 'password=set' in out
    assert 'invited@naderk.test' in out and 'password=UNUSABLE' in out
    assert 'patient2@naderk.test' not in out
    assert client_for(admin_user).get('/api/v1/auth/me/').status_code == 200


def test_list_on_an_empty_database():
    assert 'No admin accounts' in run('--list')
