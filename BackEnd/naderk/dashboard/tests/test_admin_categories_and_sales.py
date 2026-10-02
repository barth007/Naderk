"""Store categories and flash sales, as managed from the admin portal."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from naderk.core.models import User
from naderk.ecommerce.models import FlashSale, StoreCategory
from naderk.ecommerce.services import cart_add_item
from naderk.ecommerce.tests import factories
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

CATEGORIES = '/api/v1/dashboard/admin/categories/'
SALES = '/api/v1/dashboard/admin/flash-sales/'


@pytest.fixture
def ops():
    return client_for(make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER))


# ── Categories ───────────────────────────────────────────────────────────────

def test_category_lifecycle(ops):
    created = ops.post(CATEGORIES, {'name': 'Eye Care', 'description': 'Drops and wipes'}, format='json')
    again = ops.post(CATEGORIES, {'name': 'Eye Care'}, format='json')

    assert (created.status_code, created.json()['data']['slug']) == (201, 'eye-care')
    assert again.json()['data']['slug'] == 'eye-care-1'
    pk = created.json()['data']['id']

    assert ops.patch(f'{CATEGORIES}{pk}/', {'name': ' Vision Care ', 'description': ''}, format='json').status_code == 200
    category = StoreCategory.objects.get(pk=pk)
    assert (category.name, category.description) == ('Vision Care', None)

    assert ops.delete(f'{CATEGORIES}{pk}/').status_code == 200
    assert not StoreCategory.objects.filter(pk=pk).exists()


def test_list_shows_top_level_categories_with_product_counts(ops):
    parent = StoreCategory.objects.create(name='Care', slug='care')
    StoreCategory.objects.create(name='Drops', slug='drops', parent=parent)
    factories.product()                                     # lands in 'Optics'

    rows = {row['name']: row['product_count'] for row in ops.get(CATEGORIES).json()['data']}

    assert rows == {'Care': 0, 'Optics': 1}


def test_a_category_with_products_cannot_be_deleted(ops):
    item = factories.product()

    assert ops.delete(f'{CATEGORIES}{item.category_id}/').status_code == 400
    assert StoreCategory.objects.filter(pk=item.category_id).exists()


def test_category_refusals(ops, patient):
    missing = f'{CATEGORIES}00000000-0000-0000-0000-000000000000/'

    assert ops.post(CATEGORIES, {'name': '  '}, format='json').status_code == 400
    assert ops.patch(missing, {'name': 'x'}, format='json').status_code == 404
    assert ops.delete(missing).status_code == 404
    as_patient = client_for(patient)
    assert as_patient.get(CATEGORIES).status_code == 403
    assert as_patient.post(CATEGORIES, {'name': 'x'}, format='json').status_code == 403


# ── Flash sales ──────────────────────────────────────────────────────────────

def window(start_hours=-1, end_hours=1):
    now = timezone.now()
    return {'starts_at': (now + timedelta(hours=start_hours)).isoformat(),
            'ends_at': (now + timedelta(hours=end_hours)).isoformat()}


def create_sale(client, **body):
    return client.post(SALES, {'name': 'Weekend', 'discount_percent': 20, **window(), **body}, format='json')


def test_a_new_sale_is_live_and_changes_what_customers_pay(ops, patient):
    item = factories.product(price='1000.00')

    res = create_sale(ops, product_ids=[str(item.id)])

    assert res.status_code == 201, res.content
    listed = ops.get(SALES).json()['data'][0]
    assert (listed['is_live'], listed['product_count'], listed['product_ids']) == (True, 1, [str(item.id)])
    assert cart_add_item(user=patient, product_id=item.id).price == Decimal('800.00')


def test_a_future_or_switched_off_sale_is_listed_but_not_live(ops):
    create_sale(ops, name='Next week', **window(24, 48))
    off = create_sale(ops, name='Paused').json()['data']['id']
    ops.patch(f'{SALES}{off}/', {'is_active': False}, format='json')

    live = {row['name']: row['is_live'] for row in ops.get(SALES).json()['data']}

    assert live == {'Next week': False, 'Paused': False}


@pytest.mark.parametrize('body', [
    {'name': ''}, {'discount_percent': 0}, {'discount_percent': 101}, {'discount_percent': 'half'},
    {'starts_at': 'soon'}, window(2, 1),          # ends before it starts
])
def test_sale_validation(ops, body):
    assert create_sale(ops, **body).status_code == 400
    assert not FlashSale.objects.exists()


def test_editing_and_deleting_a_sale(ops):
    first, second = factories.product('a'), factories.product('b')
    pk = create_sale(ops, product_ids=[str(first.id)]).json()['data']['id']

    res = ops.patch(f'{SALES}{pk}/', {'name': 'Bank holiday', 'discount_percent': 35,
                                      'product_ids': [str(second.id)]}, format='json')

    assert res.status_code == 200, res.content
    sale = FlashSale.objects.get(pk=pk)
    assert (sale.name, sale.discount_percent) == ('Bank holiday', Decimal('35'))
    assert list(sale.products.all()) == [second]

    assert ops.delete(f'{SALES}{pk}/').status_code == 200
    assert not FlashSale.objects.exists()


@pytest.mark.parametrize('body', [{'discount_percent': 500}, {'discount_percent': -10}, window(2, 1)])
def test_editing_a_sale_is_validated_like_creating_one(ops, body):
    pk = create_sale(ops).json()['data']['id']
    ops.raise_request_exception = False

    assert ops.patch(f'{SALES}{pk}/', body, format='json').status_code == 400


def test_the_active_sale_endpoint_lists_discounted_prices(ops, patient):
    item, hidden = factories.product('drops', price='1000.00'), factories.product('wipes')
    type(hidden).objects.filter(pk=hidden.pk).update(is_active=False)
    as_patient = client_for(patient)
    assert as_patient.get(SALES + 'active/').json().get('data') is None

    create_sale(ops, product_ids=[str(item.id), str(hidden.id)])

    data = as_patient.get(SALES + 'active/').json()['data']
    assert data['name'] == 'Weekend'
    assert [(p['name'], Decimal(p['discounted_price'])) for p in data['products']] == [('Drops', Decimal('800.00'))]


def test_sale_refusals(ops, patient):
    missing = f'{SALES}00000000-0000-0000-0000-000000000000/'

    assert ops.patch(missing, {'name': 'x'}, format='json').status_code == 404
    assert ops.delete(missing).status_code == 404
    as_patient = client_for(patient)
    assert as_patient.get(SALES).status_code == 403
    assert create_sale(as_patient).status_code == 403
