"""The public storefront catalogue."""
from decimal import Decimal

import pytest

from naderk.ecommerce.models import LensOption, LensType, Product, StoreCategory
from naderk.ecommerce.tests import factories

pytestmark = pytest.mark.django_db

BASE = '/api/v1/marketplace/'


def names(response):
    return [row['name'] for row in response.json()['data']]


def test_the_catalogue_needs_no_sign_in(api_client):
    factories.product()
    frame = factories.frame_variant().frame
    factories.lens_type()

    for path in ['categories/', 'products/', 'frames/', 'lens-types/', 'lens-options/', f'frames/{frame.id}/']:
        assert api_client.get(BASE + path).status_code == 200, path


def test_inactive_products_are_hidden_from_list_and_detail(api_client):
    shown, hidden = factories.product('drops'), factories.product('wipes')
    Product.objects.filter(pk=hidden.pk).update(is_active=False)

    assert names(api_client.get(BASE + 'products/')) == ['Drops']
    assert api_client.get(f'{BASE}products/{shown.id}/').status_code == 200
    assert api_client.get(f'{BASE}products/{hidden.id}/').status_code == 404


def test_product_search_looks_in_name_and_description(api_client):
    factories.product('eye-drops')
    Product.objects.create(name='Lens cloth', slug='cloth', description='Microfibre, good for drops of water',
                           category=factories.category(), price=Decimal('500.00'))
    factories.product('case')

    assert sorted(names(api_client.get(BASE + 'products/', {'search': 'DROPS'}))) == ['Eye Drops', 'Lens cloth']


def test_category_filter_includes_subcategories(api_client):
    care = StoreCategory.objects.create(name='Care', slug='care')
    drops = StoreCategory.objects.create(name='Drops', slug='drops', parent=care)
    for slug, category in [('solution', care), ('eye-drops', drops), ('case', factories.category())]:
        Product.objects.create(name=slug, slug=slug, description='x', category=category, price=Decimal('1.00'))

    assert sorted(names(api_client.get(BASE + 'products/', {'category_slug': 'care'}))) == ['eye-drops', 'solution']
    assert names(api_client.get(BASE + 'products/', {'category_slug': 'drops'})) == ['eye-drops']


@pytest.mark.parametrize('sort_by, expected', [
    ('price_asc', ['Cheap', 'Mid', 'Dear']),
    ('price_desc', ['Dear', 'Mid', 'Cheap']),
    ('name_asc', ['Cheap', 'Dear', 'Mid']),
    ('name_desc', ['Mid', 'Dear', 'Cheap']),
])
def test_product_sorting(api_client, sort_by, expected):
    for slug, price in [('mid', '500.00'), ('cheap', '100.00'), ('dear', '900.00')]:
        factories.product(slug, price=price)

    assert names(api_client.get(BASE + 'products/', {'sort_by': sort_by})) == expected


def test_unknown_sort_is_ignored(api_client):
    factories.product()

    assert api_client.get(BASE + 'products/', {'sort_by': 'DROP TABLE'}).status_code == 200


def test_product_detail_includes_variants_and_stock(api_client):
    item = factories.product(stock=7)
    factories.variant(item, name='Large', modifier='200.00')

    data = api_client.get(f'{BASE}products/{item.id}/').json()['data']

    assert data['quantity_available'] == 7
    assert [(v['variant_name'], v['price_modifier']) for v in data['variants']] == [('Large', '200.00')]
    assert data['sale_price'] is None


def test_frames_filter_by_brand_and_search(api_client):
    acme = factories.frame_variant().frame
    other = factories.frame_variant().frame
    type(other).objects.filter(pk=other.pk).update(brand='Zenith', name='Aviator', material='Titanium')

    frames = BASE + 'frames/'
    assert [f['brand'] for f in api_client.get(frames, {'brand': 'acme'}).json()['data']] == ['Acme']
    assert [f['name'] for f in api_client.get(frames, {'search': 'titanium'}).json()['data']] == ['Aviator']
    assert len(api_client.get(frames).json()['data']) == 2
    assert acme.id != other.id


def test_frame_detail_lists_variants_and_compatible_lenses(api_client):
    variant = factories.frame_variant(stock=4)
    lens = factories.lens_type(compatible_with=variant)
    factories.lens_type('Bifocal')      # not compatible

    data = api_client.get(f'{BASE}frames/{variant.frame.id}/').json()['data']

    assert data['compatible_lens_type_ids'] == [str(lens.id)]
    assert [v['quantity_available'] for v in data['variants']] == [4]


def test_inactive_frame_is_404(api_client):
    frame = factories.frame_variant().frame
    type(frame).objects.filter(pk=frame.pk).update(is_active=False)

    assert api_client.get(f'{BASE}frames/{frame.id}/').status_code == 404
    assert api_client.get(BASE + 'frames/').json()['data'] == []


def test_inactive_lenses_and_options_are_hidden(api_client):
    LensType.objects.create(name='Single Vision', description='x')
    LensType.objects.create(name='Retired', description='x', is_active=False)
    LensOption.objects.create(name='Anti-glare')
    LensOption.objects.create(name='Retired', is_active=False)

    assert names(api_client.get(BASE + 'lens-types/')) == ['Single Vision']
    assert names(api_client.get(BASE + 'lens-options/')) == ['Anti-glare']
