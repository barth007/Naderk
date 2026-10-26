"""Public-site content (hero, testimonials, team, FAQs, trust badges, site settings)."""
import pytest

from naderk.cms.models import FAQ, HeroSlide, SiteSettings, TeamMember, Testimonial, TrustedClient, TrustMetric
from naderk.core.models import User
from naderk.users.models import RolePermissionConfig
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

BASE = '/api/v1/cms/'

# (url, model, a valid body, the field the tests edit)
RESOURCES = [
    ('hero-slides/', HeroSlide, {'title': 'See clearly', 'theme': 'DARK'}, 'title'),
    ('testimonials/', Testimonial, {'name': 'Ada', 'role': 'Patient', 'quote': 'Great care', 'rating': 4}, 'name'),
    ('team/', TeamMember, {'name': 'Dr. Okafor', 'role': 'Optometrist'}, 'name'),
    ('faqs/', FAQ, {'question': 'Do you take walk-ins?', 'answer': 'Yes.'}, 'question'),
    ('trust-metrics/', TrustMetric, {'label': 'Patients', 'value': '10k+'}, 'label'),
    ('trusted-clients/', TrustedClient, {'name': 'Acme', 'logo_url': 'https://x.test/a.png'}, 'name'),
]
resources = pytest.mark.parametrize('url, model, body, field', RESOURCES, ids=[r[0].strip('/') for r in RESOURCES])


@resources
def test_public_list_shows_active_items_in_display_order(api_client, url, model, body, field):
    model.objects.create(**{**body, field: 'Second', 'order': 2})
    model.objects.create(**{**body, field: 'First', 'order': 1})
    model.objects.create(**{**body, field: 'Hidden', 'is_active': False})

    res = api_client.get(BASE + url)

    assert res.status_code == 200
    assert [row[field] for row in res.json()['data']['results']] == ['First', 'Second']


@resources
def test_admin_creates_edits_and_deletes(admin_user, url, model, body, field):
    client = client_for(admin_user)

    created = client.post(BASE + url, body, format='json')
    assert created.status_code == 201, created.content
    pk = created.json()['data']['id']

    edited = client.put(f'{BASE}{url}{pk}/', {**body, field: 'Edited', 'order': 7}, format='json')
    assert edited.status_code == 200, edited.content
    obj = model.objects.get(pk=pk)
    assert (getattr(obj, field), obj.order) == ('Edited', 7)

    assert client.delete(f'{BASE}{url}{pk}/').status_code == 200
    assert not model.objects.exists()


@resources
def test_writes_need_the_cms_area(api_client, patient, doctor, url, model, body, field):
    existing = model.objects.create(**body)

    assert api_client.post(BASE + url, body, format='json').status_code == 401
    for user in (patient, doctor):
        client = client_for(user)
        assert client.post(BASE + url, body, format='json').status_code == 403
        assert client.put(f'{BASE}{url}{existing.pk}/', body, format='json').status_code == 403
        assert client.delete(f'{BASE}{url}{existing.pk}/').status_code == 403
    assert model.objects.count() == 1


@resources
def test_unknown_item_is_404(admin_user, url, model, body, field):
    client = client_for(admin_user)

    assert client.put(f'{BASE}{url}9999/', body, format='json').status_code == 404
    assert client.delete(f'{BASE}{url}9999/').status_code == 404


def test_operations_manager_holds_the_cms_area_until_it_is_taken_away():
    ops = make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER)
    body = {'question': 'Q', 'answer': 'A'}
    assert client_for(ops).post(BASE + 'faqs/', body, format='json').status_code == 201

    RolePermissionConfig.objects.create(role='OPERATIONS_MANAGER', permissions=['inventory'])

    assert client_for(ops).post(BASE + 'faqs/', body, format='json').status_code == 403


# ── Site settings ────────────────────────────────────────────────────────────

SETTINGS = BASE + 'site-settings/'


def test_site_settings_are_public_and_empty_until_configured(api_client):
    res = api_client.get(SETTINGS)

    assert (res.status_code, res.json()['data']) == (200, {})


def test_admin_saves_settings_into_a_single_row(admin_user, api_client):
    client = client_for(admin_user)

    client.put(SETTINGS, {'company_name': 'Naderk Eye Care', 'phone_primary': '0800'}, format='json')
    client.put(SETTINGS, {'phone_primary': '0900'}, format='json')

    assert SiteSettings.objects.count() == 1
    data = api_client.get(SETTINGS).json()['data']
    assert (data['company_name'], data['phone_primary']) == ('Naderk Eye Care', '0900')


def test_settings_cannot_be_changed_without_the_cms_area(api_client, patient):
    body = {'company_name': 'Hacked'}

    assert api_client.put(SETTINGS, body, format='json').status_code in (401, 403)
    assert client_for(patient).put(SETTINGS, body, format='json').status_code == 403
    assert not SiteSettings.objects.exists()


def test_unknown_settings_fields_are_ignored(admin_user):
    client_for(admin_user).put(SETTINGS, {'company_name': 'Naderk', 'id': 99, 'is_superuser': True}, format='json')

    assert SiteSettings.objects.get().company_name == 'Naderk'
