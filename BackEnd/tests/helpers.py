"""Builders shared by every app's tests."""
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
