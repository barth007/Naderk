"""The cart endpoints."""
from decimal import Decimal

import pytest

from naderk.ecommerce.models import CartItem
from naderk.ecommerce.tests import factories
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

CART = '/api/v1/marketplace/cart/'


def add(user, **body):
    return client_for(user).post(CART + 'add/', {k: str(v) for k, v in body.items()}, format='json')


def test_cart_requires_sign_in(api_client):
    assert api_client.get(CART).status_code == 401
    assert api_client.post(CART + 'add/', {}, format='json').status_code == 401


def test_a_new_user_has_an_empty_cart(patient):
    data = client_for(patient).get(CART).json()['data']

    assert (data['items'], float(data['total_price'])) == ([], 0)


def test_adding_products_builds_the_total(patient):
    drops, case = factories.product('drops', price='1000.00'), factories.product('case', price='250.00')

    add(patient, product_id=drops.id, quantity=2)
    data = add(patient, product_id=case.id).json()['data']

    assert len(data['items']) == 2
    assert Decimal(str(data['total_price'])) == Decimal('2250.00')


def test_adding_the_same_product_again_increases_the_quantity(patient):
    drops = factories.product()

    add(patient, product_id=drops.id, quantity=2)
    add(patient, product_id=drops.id, quantity=3)

    assert CartItem.objects.get().quantity == 5


def test_different_variants_are_separate_lines(patient):
    item = factories.product()
    small, large = factories.variant(item, 'Small'), factories.variant(item, 'Large', modifier='300.00')

    add(patient, product_id=item.id, product_variant_id=small.id)
    add(patient, product_id=item.id, product_variant_id=large.id)

    assert sorted(CartItem.objects.values_list('price', flat=True)) == [Decimal('1000.00'), Decimal('1300.00')]


def test_glasses_price_is_frame_plus_lens_plus_options(patient):
    from naderk.ecommerce.models import LensOption
    frame = factories.frame_variant(base_price='20000.00')
    lens = factories.lens_type('Non-Prescription', modifier='5000.00', compatible_with=frame)
    coating = LensOption.objects.create(name='Anti-glare', price_modifier=Decimal('1500.00'))

    res = client_for(patient).post(CART + 'add/', {
        'frame_variant_id': str(frame.id), 'lens_type_id': str(lens.id), 'lens_option_ids': [str(coating.id)],
    }, format='json')

    assert res.status_code == 200, res.content
    assert CartItem.objects.get().price == Decimal('26500.00')


@pytest.mark.parametrize('body, message', [
    ({}, 'either a Product or a Frame Variant'),
    ({'quantity': 0, 'product_id': '00000000-0000-0000-0000-000000000000'}, None),
    ({'quantity': -1, 'product_id': '00000000-0000-0000-0000-000000000000'}, None),
])
def test_add_validation(patient, body, message):
    res = client_for(patient).post(CART + 'add/', body, format='json')

    assert res.status_code == 400
    if message:
        assert message in str(res.json()['errors'])


def test_a_frame_needs_a_lens_choice(patient):
    frame = factories.frame_variant()

    assert add(patient, frame_variant_id=frame.id).status_code == 400


def test_incompatible_frame_and_lens_are_refused(patient):
    frame = factories.frame_variant()
    lens = factories.lens_type('Non-Prescription')      # no compatibility row

    res = add(patient, frame_variant_id=frame.id, lens_type_id=lens.id)

    assert res.status_code == 400
    assert 'incompatible' in str(res.json()['errors'])


def test_prescription_lens_needs_a_prescription(patient):
    frame = factories.frame_variant()
    lens = factories.lens_type('Single Vision', compatible_with=frame)

    assert add(patient, frame_variant_id=frame.id, lens_type_id=lens.id).status_code == 400
    assert add(patient, frame_variant_id=frame.id, lens_type_id=lens.id,
               prescription_id=factories.prescription(patient).id).status_code == 200


def test_unknown_product_is_a_client_error(patient):
    client = client_for(patient)
    client.raise_request_exception = False

    res = client.post(CART + 'add/', {'product_id': '00000000-0000-0000-0000-000000000000'}, format='json')

    assert res.status_code in (400, 404)


# ── Changing the cart ────────────────────────────────────────────────────────

def line(user, quantity=2):
    add(user, product_id=factories.product(f'item-{user.id}').id, quantity=quantity)
    return CartItem.objects.get(cart__user=user)


def update(user, item, quantity):
    return client_for(user).post(CART + 'update-quantity/', {'item_id': str(item.id), 'quantity': quantity}, format='json')


def test_updating_the_quantity(patient):
    item = line(patient)

    res = update(patient, item, 5)

    assert res.status_code == 200
    item.refresh_from_db()
    assert item.quantity == 5


@pytest.mark.parametrize('quantity', [0, -3])
def test_a_quantity_of_zero_or_less_removes_the_line(patient, quantity):
    item = line(patient)

    assert update(patient, item, quantity).status_code == 200
    assert not CartItem.objects.exists()


def test_update_needs_both_fields(patient):
    item = line(patient)
    client = client_for(patient)

    assert client.post(CART + 'update-quantity/', {'item_id': str(item.id)}, format='json').status_code == 400
    assert client.post(CART + 'update-quantity/', {'quantity': 2}, format='json').status_code == 400


def test_one_user_cannot_change_or_remove_anothers_cart_line(patient, other_patient):
    theirs = line(other_patient)

    assert update(patient, theirs, 9).status_code == 400
    client_for(patient).post(CART + 'remove/', {'item_id': str(theirs.id)}, format='json')

    theirs.refresh_from_db()
    assert theirs.quantity == 2


def test_removing_a_line_and_clearing_the_cart(patient):
    first = line(patient)
    add(patient, product_id=factories.product('second').id)
    client = client_for(patient)

    after_remove = client.post(CART + 'remove/', {'item_id': str(first.id)}, format='json').json()['data']
    assert len(after_remove['items']) == 1
    assert client.post(CART + 'remove/', {}, format='json').status_code == 400

    assert client.post(CART + 'clear/').json()['data']['items'] == []


def test_carts_are_private(patient, other_patient):
    line(patient)

    assert client_for(other_patient).get(CART).json()['data']['items'] == []
