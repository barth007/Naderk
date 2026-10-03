"""Offers to volunteer: the public form, and reviewing them in the admin."""
import pytest
from django.core import mail

from naderk.cms.models import SiteSettings
from naderk.core.models import User
from naderk.donations.models import Donation, VolunteerApplication
from naderk.users.models import RolePermissionConfig
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

APPLY = '/api/v1/donations/volunteers/'
ADMIN = '/api/v1/donations/admin/'


def apply(client, **body):
    body = {'full_name': 'Dr Bola Ade', 'email': 'Bola@Example.org', 'role': 'GP', 'session_format': '3x20',
            'phone': '+44 7000 000000', 'country': 'United Kingdom', 'registration_number': 'GMC 1234567',
            'message': 'Evenings work best.', **body}
    return client.post(APPLY, body, format='json')


def test_anyone_can_offer_to_volunteer(api_client):
    res = apply(api_client)

    assert res.status_code == 201, res.content
    application = VolunteerApplication.objects.get()
    assert (application.email, application.role, application.session_format, application.status) == (
        'bola@example.org', 'GP', '3x20', 'NEW')


def test_the_team_is_emailed_when_an_inbox_is_set(api_client):
    assert apply(api_client).status_code == 201
    assert mail.outbox == []                                 # no inbox configured yet

    SiteSettings.objects.create(email_general='team@example.org')
    apply(api_client, email='second@example.org')

    assert mail.outbox[-1].to == ['team@example.org']
    assert 'Dr Bola Ade' in mail.outbox[-1].subject


@pytest.mark.parametrize('body, field', [
    ({'full_name': '  '}, 'full_name'), ({'email': 'nope'}, 'email'), ({'role': 'SURGEON'}, 'role'),
    ({'session_format': '1x60'}, 'session_format'),
])
def test_application_validation(api_client, body, field):
    res = apply(api_client, **body)

    assert res.status_code == 400
    assert field in res.json()['errors']
    assert not VolunteerApplication.objects.exists()


def test_status_cannot_be_set_by_the_applicant(api_client):
    apply(api_client, status='ACCEPTED', staff_notes='hired')

    application = VolunteerApplication.objects.get()
    assert (application.status, application.staff_notes) == ('NEW', '')


def test_the_public_forms_are_rate_limited(api_client, monkeypatch):
    from django.core.cache import cache
    from rest_framework.throttling import ScopedRateThrottle

    cache.clear()
    monkeypatch.setattr(ScopedRateThrottle, 'THROTTLE_RATES', {'volunteers': '2/hour'})
    try:
        codes = [apply(api_client, email=f'v{n}@example.org').status_code for n in range(3)]
    finally:
        cache.clear()

    assert codes == [201, 201, 429]


# ── Admin ────────────────────────────────────────────────────────────────────

def test_admin_reviews_applications(api_client, admin_user):
    apply(api_client)
    apply(api_client, full_name='Nurse Ife', email='ife@example.org', role='NURSE')
    client = client_for(admin_user)

    data = client.get(ADMIN + 'volunteers/').json()['data']
    assert data['count'] == 2 and data['status_counts']['NEW'] == 2
    assert [r['full_name'] for r in client.get(ADMIN + 'volunteers/', {'role': 'nurse'}).json()['data']['results']] == ['Nurse Ife']

    pk = VolunteerApplication.objects.get(role='GP').pk
    res = client.patch(f'{ADMIN}volunteers/{pk}/', {'status': 'CONTACTED', 'staff_notes': 'Call booked'}, format='json')

    assert res.status_code == 200, res.content
    assert (res.json()['data']['status'], res.json()['data']['reviewed_by_name']) == ('CONTACTED', 'Admin Test')
    assert client.get(ADMIN + 'volunteers/', {'status': 'contacted', 'q': 'bola'}).json()['data']['count'] == 1


def test_review_validation(admin_user, api_client):
    apply(api_client)
    client = client_for(admin_user)
    pk = VolunteerApplication.objects.get().pk

    assert client.patch(f'{ADMIN}volunteers/{pk}/', {'status': 'HIRED'}, format='json').status_code == 400
    assert client.patch(f'{ADMIN}volunteers/00000000-0000-0000-0000-000000000000/', {}, format='json').status_code == 404


def test_admin_sees_gifts_with_paid_totals_per_currency(admin_user):
    for name, currency, amount, status, freq in [
        ('A', 'NGN', '20000', 'PAID', 'ANNUAL'), ('B', 'NGN', '9999', 'PAID', 'ONE_TIME'),
        ('C', 'GBP', '10', 'PAID', 'ANNUAL'), ('D', 'NGN', '50000', 'PENDING', 'ONE_TIME'),
    ]:
        Donation.objects.create(donor_name=name, donor_email=f'{name.lower()}@x.org', currency=currency,
                                amount=amount, status=status, frequency=freq)

    data = client_for(admin_user).get(ADMIN + 'donations/').json()['data']

    assert data['count'] == 4
    assert data['totals'] == [{'currency': 'GBP', 'amount': '10.00', 'count': 1},
                              {'currency': 'NGN', 'amount': '29999.00', 'count': 2}]
    assert data['annual_donors'] == 2
    paid_naira = client_for(admin_user).get(ADMIN + 'donations/', {'status': 'paid', 'currency': 'ngn'}).json()['data']
    assert sorted(r['donor_name'] for r in paid_naira['results']) == ['A', 'B']


@pytest.mark.parametrize('role', [User.Role.PATIENT, User.Role.DOCTOR, User.Role.AGENT, User.Role.OPERATIONS_MANAGER])
def test_admin_screens_need_the_donations_area(role):
    client = client_for(make_user('x@naderk.test', role=role))

    assert client.get(ADMIN + 'donations/').status_code == 403
    assert client.get(ADMIN + 'volunteers/').status_code == 403


def test_the_donations_area_can_be_granted_to_staff():
    agent = make_user('agent@naderk.test', role=User.Role.AGENT)
    RolePermissionConfig.objects.create(role='AGENT', permissions=['messaging', 'donations'])

    assert client_for(agent).get(ADMIN + 'volunteers/').status_code == 200
