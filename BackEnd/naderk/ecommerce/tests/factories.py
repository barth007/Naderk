"""Small builders for store data, shared by the pytest-style tests."""
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from naderk.ecommerce.models import (
    FlashSale, Frame, FrameLensCompatibility, FrameVariant, LensType, Prescription,
    Product, ProductVariant, StoreCategory,
)


def category(slug='optics'):
    return StoreCategory.objects.get_or_create(slug=slug, defaults={'name': slug.title()})[0]


def product(slug='eye-drops', price='1000.00', stock=10):
    return Product.objects.create(
        name=slug.replace('-', ' ').title(), slug=slug, description='x', category=category(),
        price=Decimal(price), quantity_available=stock, low_stock_threshold=2,
    )


def variant(of, name='Standard', stock=10, modifier='0.00'):
    return ProductVariant.objects.create(
        product=of, variant_name=name, quantity_available=stock,
        low_stock_threshold=2, price_modifier=Decimal(modifier),
    )


def flash_sale(*products, percent='25.00', active=True, started_hours_ago=1, ends_in_hours=1):
    now = timezone.now()
    sale = FlashSale.objects.create(
        name='Promo', discount_percent=Decimal(percent), is_active=active,
        starts_at=now - timedelta(hours=started_hours_ago),
        ends_at=now + timedelta(hours=ends_in_hours),
    )
    sale.products.set(products)
    return sale


def frame_variant(stock=5, base_price='20000.00'):
    frame = Frame.objects.create(
        name='Wayfarer', brand='Acme', style='Wayfarer', material='Acetate',
        base_price=Decimal(base_price),
    )
    return FrameVariant.objects.create(
        frame=frame, color='Black', size='Medium', quantity_available=stock, low_stock_threshold=1,
    )


def lens_type(name='Single Vision', modifier='5000.00', compatible_with=None):
    lens = LensType.objects.create(name=name, description='x', price_modifier=Decimal(modifier))
    if compatible_with is not None:
        FrameLensCompatibility.objects.create(frame=compatible_with.frame, lens_type=lens)
    return lens


def prescription(patient):
    return Prescription.objects.create(
        patient=patient, right_sph=Decimal('-1.50'), left_sph=Decimal('-1.25'),
        pupillary_distance=Decimal('62.0'),
    )
