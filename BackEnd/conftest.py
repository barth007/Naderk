import pytest
from rest_framework.test import APIClient

from naderk.core.models import User
from tests.helpers import client_for, make_user


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
