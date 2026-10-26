"""The Extend Life Africa page's copy is editable like the About page."""
from io import StringIO

import pytest
from django.core.management import call_command

from naderk.cms.extend_life_africa_content import EXTEND_LIFE_AFRICA_SECTIONS
from naderk.cms.models import PageSection
from naderk.cms.page_schemas import schema_for
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

PAGE = '/api/v1/cms/pages/extend_life_africa/'


def test_every_seeded_section_and_field_is_declared_in_the_schema():
    schema = {s['key']: {f['name'] for f in s['fields']} for s in schema_for('extend_life_africa')['sections']}

    assert set(EXTEND_LIFE_AFRICA_SECTIONS) == set(schema)
    for key, content in EXTEND_LIFE_AFRICA_SECTIONS.items():
        assert set(content) <= schema[key], key


def test_seeding_fills_the_page_without_overwriting_edits(api_client):
    PageSection.objects.create(page='extend_life_africa', section_key='contact', content={'email': 'real@ela.org'})

    call_command('seed_page_content', '--page', 'extend_life_africa', stdout=StringIO())

    sections = api_client.get(PAGE).json()['data']['sections']
    assert set(sections) == set(EXTEND_LIFE_AFRICA_SECTIONS)
    assert sections['contact'] == {'email': 'real@ela.org'}
    assert sections['hero']['title'] == 'Extend a life.'


def test_admin_edits_a_section_and_the_page_shows_it(admin_user, api_client):
    res = client_for(admin_user).put(f'{PAGE}sections/contact/', {
        'content': {'ng_phone': '+234 803 000 0000', 'email': 'hello@ela.org', 'not_a_field': 'x'}}, format='json')

    assert res.status_code == 200, res.content
    assert api_client.get(PAGE).json()['data']['sections']['contact'] == {
        'ng_phone': '+234 803 000 0000', 'email': 'hello@ela.org'}
    assert client_for(admin_user).get(f'{PAGE}schema/').json()['data']['label'] == 'Extend Life Africa'
