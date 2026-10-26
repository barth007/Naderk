"""Store administration: creating products, hiding them, sales history and the order book."""
import json
from decimal import Decimal
from unittest.mock import Mock

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile

from naderk.common.storage.exceptions import StorageProviderError
from naderk.common.storage.service import storage_service
from naderk.core.models import User
from naderk.ecommerce.models import Order, Product
from naderk.ecommerce.services import cart_add_item, order_create_from_cart, order_process_payment
from naderk.ecommerce.tests import factories
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

BASE = '/api/v1/dashboard/admin/'


@pytest.fixture
def ops():
    return make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER)


@pytest.fixture
def storage(monkeypatch):
    provider = Mock()
    provider.upload.side_effect = lambda file, key, bucket, content_type: f'https://media.naderk.test/{bucket}/{key}'
    monkeypatch.setattr(storage_service, '_provider', provider)
    return provider


def create(user, **body):
    body = {'name': 'Eye Drops', 'description': 'Soothing', 'category_id': str(factories.category().id),
            'price': '1500.00', **body}
    return client_for(user).post(BASE + 'products/create/', body, format='multipart')


# ── Creating products ────────────────────────────────────────────────────────

def test_product_is_created_with_stock_and_a_unique_slug(ops):
    first = create(ops, quantity_available=20, low_stock_threshold=4)
    second = create(ops)

    assert (first.status_code, second.status_code) == (201, 201)
    product = Product.objects.get(id=first.json()['data']['id'])
    assert (product.slug, product.price, product.quantity_available, product.low_stock_threshold) == (
        'eye-drops', Decimal('1500.00'), 20, 4)
    assert Product.objects.get(id=second.json()['data']['id']).slug == 'eye-drops-1'


def test_images_are_uploaded_and_stored_in_order(ops, storage):
    res = create(ops, image_0=SimpleUploadedFile('a.png', b'x'), image_1=SimpleUploadedFile('b.png', b'y'))

    images = Product.objects.get(id=res.json()['data']['id']).images
    assert len(images) == 2 and all('/products/' in url for url in images)


def test_a_failed_image_upload_does_not_lose_the_product(ops, storage):
    storage.upload.side_effect = StorageProviderError('bucket down')

    res = create(ops, image_0=SimpleUploadedFile('a.png', b'x'))

    assert res.status_code == 201
    assert Product.objects.get().images == []


def test_variants_are_created_from_the_json_field(ops):
    variants = json.dumps([
        {'variant_name': '10ml', 'quantity_available': 5, 'price_modifier': 0},
        {'variant_name': '30ml', 'quantity_available': 3, 'price_modifier': 900, 'sku': 'DROPS-30'},
        {'variant_name': '  '},                                     # blank names are skipped
    ])

    res = create(ops, variants=variants)

    product = Product.objects.get(id=res.json()['data']['id'])
    assert sorted(product.variants.values_list('variant_name', 'price_modifier')) == [
        ('10ml', Decimal('0.00')), ('30ml', Decimal('900.00'))]


@pytest.mark.parametrize('missing', ['name', 'description', 'category_id', 'price'])
def test_required_fields(ops, missing):
    assert create(ops, **{missing: ''}).status_code == 400
    assert not Product.objects.exists()


def test_unknown_category_and_permissions(ops, patient):
    assert create(ops, category_id='00000000-0000-0000-0000-000000000000').status_code == 404
    assert create(patient).status_code == 403
    assert create(make_user('agent@naderk.test', role=User.Role.AGENT)).status_code == 403


# ── Hiding, history, order book ──────────────────────────────────────────────

def test_toggle_hides_a_product_from_the_storefront_and_back(ops, api_client):
    item = factories.product()
    url = f'{BASE}products/{item.id}/toggle-status/'

    assert client_for(ops).post(url).json()['data']['is_active'] is False
    assert api_client.get('/api/v1/marketplace/products/').json()['data'] == []

    assert client_for(ops).post(url).json()['data']['is_active'] is True
    assert client_for(ops).post(f'{BASE}products/00000000-0000-0000-0000-000000000000/toggle-status/').status_code == 404


def paid_order(user, item, quantity=1, paid=True):
    cart_add_item(user=user, product_id=item.id, quantity=quantity)
    order = order_create_from_cart(user=user, shipping_address='1 Test Street')
    return order_process_payment(order=order, actor=user, payment_reference='REF') if paid else order


def test_sales_history_counts_only_paid_orders(ops, patient, other_patient):
    item = factories.product(stock=20)
    paid_order(patient, item, quantity=3)
    paid_order(other_patient, item, quantity=2, paid=False)

    rows = client_for(ops).get(f'{BASE}products/{item.id}/history/').json()['data']

    assert [(row['type'], row['quantity'], row['customer']) for row in rows] == [('SOLD', 3, 'Patient Test')]


def test_order_book_lists_newest_first_and_filters_by_status(ops, patient, other_patient):
    item = factories.product(stock=20)
    older = paid_order(patient, item)
    newer = paid_order(other_patient, item, paid=False)
    client = client_for(ops)

    rows = client.get(BASE + 'orders/').json()['data']
    assert [row['id'] for row in rows] == [str(newer.id), str(older.id)]
    assert rows[1]['first_item_name'] == 'Eye Drops' and rows[1]['first_item_qty'] == 1

    pending = client.get(BASE + 'orders/', {'status': Order.Status.PENDING}).json()['data']
    assert [row['id'] for row in pending] == [str(newer.id)]


def test_order_book_limit_is_clamped(ops, patient):
    item = factories.product(stock=20)
    for _ in range(3):
        paid_order(patient, item)
    client = client_for(ops)

    assert len(client.get(BASE + 'orders/', {'limit': 2}).json()['data']) == 2
    assert len(client.get(BASE + 'orders/', {'limit': 0}).json()['data']) == 1
    assert len(client.get(BASE + 'orders/', {'limit': 'all'}).json()['data']) == 3


def test_store_admin_endpoints_need_their_areas(patient, doctor):
    item = factories.product()

    for user in (patient, doctor):
        client = client_for(user)
        assert client.get(BASE + 'orders/').status_code == 403
        assert client.get(f'{BASE}products/{item.id}/history/').status_code == 403
        assert client.post(f'{BASE}products/{item.id}/toggle-status/').status_code == 403
