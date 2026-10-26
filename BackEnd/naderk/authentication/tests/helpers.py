import re

from django.core import mail

REGISTER = '/api/v1/auth/register/'
LOGIN = '/api/v1/auth/login/'
VERIFY_OTP = '/api/v1/auth/verify-otp/'
RESEND_OTP = '/api/v1/auth/resend-otp/'
REFRESH = '/api/v1/auth/refresh/'
ME = '/api/v1/auth/me/'
FORGOT = '/api/v1/auth/forgot-password/'
RESET = '/api/v1/auth/reset-password/'
CHANGE = '/api/v1/auth/change-password/'

PASSWORD = 'a-long-password-1'


def register(client, email='ada@naderk.test', password=PASSWORD, full_name='Ada Lovelace'):
    return client.post(REGISTER, {'email': email, 'password': password, 'full_name': full_name}, format='json')


def emailed_code():
    """The six-digit code in the most recent email."""
    return re.search(r'\b(\d{6})\b', mail.outbox[-1].body).group(1)


def emailed_reset_token():
    return re.search(r'reset-password\?token=([\w-]+)', mail.outbox[-1].body).group(1)


def login(client, email='ada@naderk.test', password=PASSWORD):
    return client.post(LOGIN, {'email': email, 'password': password}, format='json')
