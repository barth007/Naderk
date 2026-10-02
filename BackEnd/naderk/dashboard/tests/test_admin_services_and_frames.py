"""Medical services and frames, as managed from the admin portal."""
from decimal import Decimal

import pytest

from naderk.appointments.models import MedicalService
from naderk.core.models import User
from naderk.ecommerce.models import Frame, FrameVariant
from naderk.ecommerce.services import cart_add_item, order_create_from_cart
from naderk.ecommerce.tests import factories
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

SERVICES = '/api/v1/dashboard/admin/services/'
FRAMES = '/api/v1/dashboard/admin/frames/'


@pytest.fixture
def admin(admin_user):
    return client_for(admin_user)


# ── Medical services ─────────────────────────────────────────────────────────

def new_service(client, **body):
    body = {'name': 'Glaucoma Review', 'required_specialization': 'OPTOMETRIST', 'fee': '15000', **body}
    return client.post(SERVICES, body, format='json')


def test_creating_a_doctor_service(admin):
    res = new_service(admin, available_online=True, duration_minutes=45)

    assert res.status_code == 201, res.content
    service = MedicalService.objects.get()
    assert (service.slug, service.fee, service.billing_type) == ('glaucoma-review', Decimal('15000'), 'PER_VISIT')
    assert (service.requires_doctor, service.available_online, service.duration_minutes) == (True, True, 45)


def test_a_facility_service_needs_no_specialization_and_is_never_online(admin):
    res = new_service(admin, name='OCT Scan', requires_doctor=False, required_specialization='', available_online=True)

    assert res.status_code == 201, res.content
    service = MedicalService.objects.get()
    assert (service.requires_doctor, service.required_specialization, service.available_online) == (False, None, False)


def test_a_session_pack_needs_a_session_count(admin):
    assert new_service(admin, billing_type='SESSION_PACK').status_code == 400
    assert new_service(admin, billing_type='SESSION_PACK', sessions_included=0).status_code == 400

    res = new_service(admin, billing_type='SESSION_PACK', sessions_included=6)

    assert res.status_code == 201
    assert MedicalService.objects.get().sessions_included == 6


@pytest.mark.parametrize('body, field', [
    ({'name': ''}, 'name'),
    ({'required_specialization': ''}, 'required_specialization'),
    ({'required_specialization': 'WIZARD'}, 'required_specialization'),
    ({'billing_type': 'YEARLY'}, 'billing_type'),
    ({'fee': 'free'}, 'fee'),
])
def test_service_validation(admin, body, field):
    res = new_service(admin, **body)

    assert res.status_code == 400
    assert field in res.json()['errors']
    assert not MedicalService.objects.exists()


def test_service_names_are_unique_whatever_the_case(admin):
    new_service(admin)
    other = new_service(admin, name='Retina Review').json()['data']['id']

    assert new_service(admin, name='GLAUCOMA REVIEW').status_code == 400
    assert admin.patch(f'{SERVICES}{other}/', {'name': 'glaucoma review'}, format='json').status_code == 400
    assert admin.patch(f'{SERVICES}{other}/', {'name': 'Retina Review'}, format='json').status_code == 200   # its own name


def test_editing_a_service(admin):
    pk = new_service(admin, available_online=True).json()['data']['id']

    res = admin.patch(f'{SERVICES}{pk}/', {'fee': '18000', 'billing_type': 'MONTHLY', 'duration_minutes': 60}, format='json')

    assert res.status_code == 200, res.content
    service = MedicalService.objects.get(pk=pk)
    assert (service.fee, service.billing_type, service.duration_minutes) == (Decimal('18000'), 'MONTHLY', 60)


def test_switching_a_service_to_facility_clears_its_doctor_settings(admin):
    pk = new_service(admin, available_online=True).json()['data']['id']

    admin.patch(f'{SERVICES}{pk}/', {'requires_doctor': False}, format='json')

    service = MedicalService.objects.get(pk=pk)
    assert (service.required_specialization, service.available_online) == (None, False)


def test_edit_validation(admin):
    pk = new_service(admin).json()['data']['id']
    url = f'{SERVICES}{pk}/'

    assert admin.patch(url, {'name': ' '}, format='json').status_code == 400
    assert admin.patch(url, {'fee': 'free'}, format='json').status_code == 400
    assert admin.patch(url, {'billing_type': 'YEARLY'}, format='json').status_code == 400
    assert admin.patch(url, {'required_specialization': 'WIZARD'}, format='json').status_code == 400


def test_deleting_a_service_only_deactivates_it(admin, api_client):
    pk = new_service(admin).json()['data']['id']

    assert admin.delete(f'{SERVICES}{pk}/').status_code == 200

    assert MedicalService.objects.get(pk=pk).is_active is False
    assert api_client.get('/api/v1/appointments/services/').json()['data']['results'] == []
    assert [s['is_active'] for s in admin.get(SERVICES).json()['data']] == [False]     # admins still see it
    assert admin.get(f'{SERVICES}{pk}/').json()['data']['id'] == pk


def test_service_admin_access(admin, patient, doctor):
    missing = f'{SERVICES}00000000-0000-0000-0000-000000000000/'
    assert admin.get(missing).status_code == 404
    assert admin.patch(missing, {}, format='json').status_code == 404
    assert admin.delete(missing).status_code == 404

    medical_agent = client_for(make_user('ma@naderk.test', role=User.Role.MEDICAL_AGENT))
    assert medical_agent.get(SERVICES).status_code == 200                    # holds the services area
    for user in (patient, doctor):
        client = client_for(user)
        assert client.get(SERVICES).status_code == 403
        assert new_service(client).status_code == 403


@pytest.mark.xfail(strict=True, reason='A service fee is accepted as any number, including a negative one.')
def test_a_fee_cannot_be_negative(admin):
    assert new_service(admin, fee='-500').status_code == 400


# ── Frames ───────────────────────────────────────────────────────────────────

def new_frame(client, **body):
    body = {'name': 'Aviator', 'brand': 'Acme', 'base_price': '25000', **body}
    return client.post(FRAMES, body, format='json')


def test_creating_a_frame_with_variants_and_images(admin, api_client):
    res = new_frame(admin, gender='MEN', lens_width='52', bridge_width='', images=['https://m.test/1.png', '', 'https://m.test/2.png'],
                    variants=[{'color': 'Gold', 'size': 'Medium', 'quantity_available': 4, 'sku': 'AV-GLD-M'},
                              {'color': '', 'size': 'Large'}])                    # incomplete: skipped

    assert res.status_code == 201, res.content
    frame = Frame.objects.get()
    assert (frame.style, frame.material, frame.gender) == ('Rectangle', 'Acetate', 'MEN')    # sensible defaults
    assert (frame.lens_width, frame.bridge_width) == (52, None)
    assert (frame.images, frame.front_image) == (['https://m.test/1.png', 'https://m.test/2.png'], 'https://m.test/1.png')
    assert list(frame.variants.values_list('color', 'quantity_available')) == [('Gold', 4)]
    assert len(api_client.get('/api/v1/marketplace/frames/').json()['data']) == 1


def test_only_the_first_four_images_are_kept(admin):
    new_frame(admin, images=[f'https://m.test/{n}.png' for n in range(6)])

    assert len(Frame.objects.get().images) == 4


@pytest.mark.parametrize('body, field', [
    ({'name': ''}, 'name'), ({'brand': ' '}, 'brand'), ({'base_price': ''}, 'base_price'), ({'base_price': 'lots'}, 'base_price'),
])
def test_frame_validation(admin, body, field):
    res = new_frame(admin, **body)

    assert res.status_code == 400
    assert field in res.json()['errors']
    assert not Frame.objects.exists()


def test_editing_a_frame_and_replacing_its_variants(admin):
    pk = new_frame(admin, variants=[{'color': 'Gold', 'size': 'Medium'}]).json()['data']['id']

    res = admin.patch(f'{FRAMES}{pk}/', {'base_price': '30000', 'variants': [
        {'color': 'Black', 'size': 'Small', 'quantity_available': 2},
        {'color': 'Black', 'size': 'Large', 'quantity_available': 5}]}, format='json')

    assert res.status_code == 200, res.content
    frame = Frame.objects.get(pk=pk)
    assert frame.base_price == Decimal('30000')
    assert sorted(frame.variants.values_list('size', flat=True)) == ['Large', 'Small']


def test_editing_without_variants_leaves_them_alone(admin):
    pk = new_frame(admin, variants=[{'color': 'Gold', 'size': 'Medium'}]).json()['data']['id']

    admin.patch(f'{FRAMES}{pk}/', {'name': 'Aviator II'}, format='json')

    assert FrameVariant.objects.filter(frame_id=pk).count() == 1


def test_toggle_hides_a_frame_from_the_storefront_but_not_from_admins(admin, api_client):
    pk = new_frame(admin).json()['data']['id']

    assert admin.post(f'{FRAMES}{pk}/toggle/').json()['data']['is_active'] is False

    assert api_client.get('/api/v1/marketplace/frames/').json()['data'] == []
    assert [f['id'] for f in admin.get(FRAMES).json()['data']] == [pk]
    assert admin.get(f'{FRAMES}{pk}/').status_code == 200


def test_an_unused_frame_is_deleted(admin):
    pk = new_frame(admin, variants=[{'color': 'Gold', 'size': 'Medium'}]).json()['data']['id']

    assert admin.delete(f'{FRAMES}{pk}/').status_code == 200
    assert not Frame.objects.exists() and not FrameVariant.objects.exists()


def test_a_frame_that_has_been_ordered_is_deactivated_instead(admin, patient):
    variant = factories.frame_variant()
    lens = factories.lens_type('Non-Prescription', compatible_with=variant)
    cart_add_item(user=patient, frame_variant_id=variant.id, lens_type_id=lens.id)
    order_create_from_cart(user=patient, shipping_address='1 Test Street')

    res = admin.delete(f'{FRAMES}{variant.frame_id}/')

    assert res.status_code == 200
    assert res.json()['data']['deactivated'] is True
    assert Frame.objects.get(pk=variant.frame_id).is_active is False


def test_frame_admin_access(admin, patient, doctor):
    missing = '00000000-0000-0000-0000-000000000000'
    for call in (lambda: admin.get(f'{FRAMES}{missing}/'), lambda: admin.patch(f'{FRAMES}{missing}/', {}, format='json'),
                 lambda: admin.delete(f'{FRAMES}{missing}/'), lambda: admin.post(f'{FRAMES}{missing}/toggle/')):
        assert call().status_code == 404

    ops = client_for(make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER))
    assert ops.get(FRAMES).status_code == 200
    for user in (patient, doctor):
        client = client_for(user)
        assert client.get(FRAMES).status_code == 403
        assert new_frame(client).status_code == 403
