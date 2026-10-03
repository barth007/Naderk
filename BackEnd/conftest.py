import pytest
from rest_framework.test import APIClient

from naderk.core.models import User
from tests.helpers import client_for, make_user

# Import every view module now, before any test runs. Views bind names like
# `get_provider` at import time, and Django imports them on the first request;
# if that request came from a test that had patched one of those names, the
# patch stayed in the view for the rest of the run.
from django.urls import get_resolver  # noqa: E402

get_resolver().url_patterns


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def patient(db):
    return make_user('patient@naderk.test')


@pytest.fixture
def other_patient(db):
    return make_user('other-patient@naderk.test')


@pytest.fixture
def doctor(db):
    # A post_save signal creates the DoctorProfile.
    return make_user('doctor@naderk.test', role=User.Role.DOCTOR)


@pytest.fixture
def admin_user(db):
    return make_user('admin@naderk.test', role=User.Role.ADMIN)


@pytest.fixture
def auth_client(patient):
    """An API client authenticated as `patient`."""
    return client_for(patient)


@pytest.fixture(autouse=True)
def no_real_http(monkeypatch):
    """Tests must stub the provider they exercise; none may reach a real one."""
    def refuse(self, method, url, *args, **kwargs):
        raise RuntimeError(f'Test attempted a real HTTP request: {method} {url}')

    monkeypatch.setattr('requests.sessions.Session.request', refuse)


@pytest.fixture
def channels_db(monkeypatch):
    """
    For tests that drive a Channels consumer with async_to_sync.

    async_to_sync runs the consumer's database calls back on the test's own
    thread, so they see the test's uncommitted rows — but Channels closes "old"
    connections around each call, which here is the test's connection. Keeping
    it open avoids a transactional test database, whose flush would wipe the
    rows that migrations seed.
    """
    monkeypatch.setattr('channels.db.close_old_connections', lambda: None)
