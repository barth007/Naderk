import pytest
from rest_framework.test import APIClient

from naderk.core.models import User

PASSWORD = 'pw12345!'


def make_user(email, role=User.Role.PATIENT, **extra):
    extra.setdefault('first_name', email.split('@')[0].title())
    extra.setdefault('last_name', 'Test')
    return User.objects.create_user(email=email, password=PASSWORD, role=role, **extra)


def client_for(user):
    """An API client authenticated as `user`."""
    client = APIClient()
    client.force_authenticate(user)
    return client


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
