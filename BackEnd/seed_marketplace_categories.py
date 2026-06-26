"""
Seed script: 3 top-level categories (Wellness, Frames, Laboratory Equipment)
with sample products and frames for each.

Run from BackEnd/ directory:
    python seed_marketplace_categories.py
"""

import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from naderk.ecommerce.models import (
    StoreCategory, Product, ProductVariant, Frame, FrameVariant,
    LensType, FrameLensCompatibility, LensOption
)


def seed():
    print("Clearing existing catalog...")
    ProductVariant.objects.all().delete()
    Product.objects.all().delete()
    FrameLensCompatibility.objects.all().delete()
    FrameVariant.objects.all().delete()
    Frame.objects.all().delete()
    LensOption.objects.all().delete()
    LensType.objects.all().delete()
    StoreCategory.objects.all().delete()

    # ── Categories ───────────────────────────────────────────────────────────────
    print("Seeding Categories...")
    category_data = [
        {
            "name": "Wellness",
            "slug": "wellness",
            "description": "Eye health supplements, drops, and protective care products",
        },
        {
            "name": "Frames",
            "slug": "frames",
            "description": "Eyewear frames, optical hardware, and designer eyeglasses",
        },
        {
            "name": "Laboratory Equipment",
            "slug": "laboratory-equipment",
            "description": "Diagnostic instruments, slit lamps, tonometers, and ophthalmic tools",
        },
    ]

    category_map = {}
    for c in category_data:
        cat, _ = StoreCategory.objects.get_or_create(slug=c["slug"], defaults=c)
        category_map[c["slug"]] = cat
        print(f"  ✓ {c['name']}")

    # ── Lens Types ────────────────────────────────────────────────────────────────
    print("Seeding Lens Types...")
    lens_data = [
        {"name": "Single Vision",      "description": "Corrects one field of vision.",                  "price_modifier": Decimal("0.00")},
        {"name": "Bifocal",            "description": "Two focal points for near and far vision.",       "price_modifier": Decimal("20.00")},
        {"name": "Progressive",        "description": "Seamless transition across focal zones.",         "price_modifier": Decimal("40.00")},
        {"name": "Non-Prescription",   "description": "Standard plano lenses with no correction.",      "price_modifier": Decimal("0.00")},
        {"name": "Blue Light Filter",  "description": "Reduces digital screen blue light exposure.",    "price_modifier": Decimal("10.00")},
        {"name": "Polarized",          "description": "Eliminates glare for outdoor activities.",       "price_modifier": Decimal("15.00")},
    ]
    lens_map = {}
    for l in lens_data:
        lt, _ = LensType.objects.get_or_create(name=l["name"], defaults=l)
        lens_map[l["name"]] = lt

    # ── Lens Upgrades ─────────────────────────────────────────────────────────────
    print("Seeding Lens Upgrades...")
    upgrade_data = [
        {"name": "Anti-Reflective Coating", "price_modifier": Decimal("15.00")},
        {"name": "Scratch Resistance",       "price_modifier": Decimal("10.00")},
        {"name": "UV Protection",            "price_modifier": Decimal("8.00")},
        {"name": "Hydrophobic Coating",      "price_modifier": Decimal("12.00")},
    ]
    for u in upgrade_data:
        LensOption.objects.get_or_create(name=u["name"], defaults=u)

    # ── Frames (optical builder) ──────────────────────────────────────────────────
    print("Seeding Frames...")

    frames_data = [
        {
            "name": "Classic Wayfarer",
            "brand": "Ray-Ban",
            "style": "Wayfarer",
            "material": "Acetate",
            "base_price": Decimal("25000.00"),
            "front_image": "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400",
            "colors": ["Black", "Tortoise", "Blue", "Red"],
        },
        {
            "name": "Aviator Classic",
            "brand": "Ray-Ban",
            "style": "Aviator",
            "material": "Metal",
            "base_price": Decimal("32000.00"),
            "front_image": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400",
            "colors": ["Gold", "Silver", "Gunmetal"],
        },
        {
            "name": "Holbrook",
            "brand": "Oakley",
            "style": "Square",
            "material": "Acetate",
            "base_price": Decimal("28000.00"),
            "front_image": "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=400",
            "colors": ["Matte Black", "Tortoise", "Brown"],
        },
        {
            "name": "Frogskins",
            "brand": "Oakley",
            "style": "Round",
            "material": "Plastic",
            "base_price": Decimal("22000.00"),
            "front_image": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400",
            "colors": ["Black", "Crystal Blue", "White"],
        },
        {
            "name": "Meflecto",
            "brand": "Persol",
            "style": "Oval",
            "material": "Acetate",
            "base_price": Decimal("45000.00"),
            "front_image": "https://images.unsplash.com/photo-1473496169904-658ba7574b0d?w=400",
            "colors": ["Havana", "Black", "Blue"],
        },
        {
            "name": "Steve McQueen",
            "brand": "Persol",
            "style": "Round",
            "material": "Acetate",
            "base_price": Decimal("52000.00"),
            "front_image": "https://images.unsplash.com/photo-1555361369-6bb56f3e13c2?w=400",
            "colors": ["Havana", "Honey", "Green"],
        },
        {
            "name": "Air Titanium",
            "brand": "Lindberg",
            "style": "Rimless",
            "material": "Titanium",
            "base_price": Decimal("68000.00"),
            "front_image": "https://images.unsplash.com/photo-1583394293214-6f8c22785e7c?w=400",
            "colors": ["Silver", "Gold", "Rose Gold"],
        },
    ]

    sizes = ["Small", "Medium", "Large"]
    for f in frames_data:
        frame = Frame.objects.create(
            name=f["name"],
            brand=f["brand"],
            style=f["style"],
            material=f["material"],
            base_price=f["base_price"],
            front_image=f["front_image"],
        )
        for color in f["colors"]:
            for size in sizes:
                FrameVariant.objects.create(
                    frame=frame,
                    color=color,
                    size=size,
                    quantity_available=20,
                    sku=f"{f['brand'][:3].upper()}-{f['name'][:3].upper()}-{color[:3].upper()}-{size[:2].upper()}",
                )
        for lt in lens_map.values():
            FrameLensCompatibility.objects.get_or_create(frame=frame, lens_type=lt)
        print(f"  ✓ {f['brand']} {f['name']}")

    # ── Products — Wellness ───────────────────────────────────────────────────────
    print("Seeding Wellness products...")
    wellness_products = [
        {
            "name": "NuVision Eye Drops",
            "slug": "nuvision-eye-drops",
            "description": "Lubricating eye drops for dry-eye relief. Preservative-free formula.",
            "price": Decimal("3500.00"),
            "image": "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400",
        },
        {
            "name": "Omega-3 Vision Supplements",
            "slug": "omega3-vision-supplements",
            "description": "High-strength Omega-3 capsules for long-term retinal and macular health.",
            "price": Decimal("6200.00"),
            "image": "https://images.unsplash.com/photo-1616671285420-1a7776d65604?w=400",
        },
        {
            "name": "UV Screen Wipes (50 pack)",
            "slug": "uv-screen-wipes-50",
            "description": "Anti-static, alcohol-free lens cleaning wipes safe for all coatings.",
            "price": Decimal("1800.00"),
            "image": "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400",
        },
        {
            "name": "BluGuard Screen Shield",
            "slug": "bluguard-screen-shield",
            "description": "Blue-light blocking film for monitors. Easy apply, bubble-free.",
            "price": Decimal("4500.00"),
            "image": "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400",
        },
        {
            "name": "Lutein & Zeaxanthin Complex",
            "slug": "lutein-zeaxanthin-complex",
            "description": "Antioxidant complex supporting macular pigment density.",
            "price": Decimal("7800.00"),
            "image": "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400",
        },
    ]
    _create_products(wellness_products, category_map["wellness"])

    # ── Products — Frames ─────────────────────────────────────────────────────────
    print("Seeding Frames products...")
    frames_products = [
        {
            "name": "Ray-Ban Classic Wayfarer",
            "slug": "rb-classic-wayfarer",
            "description": "Iconic acetate frame. Available in 4 colours. Includes hard case.",
            "price": Decimal("25000.00"),
            "image": "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400",
        },
        {
            "name": "Ray-Ban Aviator Classic",
            "slug": "rb-aviator-classic",
            "description": "Timeless metal pilot frame with green G-15 lenses.",
            "price": Decimal("32000.00"),
            "image": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400",
        },
        {
            "name": "Oakley Holbrook",
            "slug": "oakley-holbrook",
            "description": "Lightweight O-Matter frame with Unobtainium nose pads.",
            "price": Decimal("28000.00"),
            "image": "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=400",
        },
        {
            "name": "Persol Meflecto",
            "slug": "persol-meflecto",
            "description": "Handcrafted Italian acetate with supreme flex hinge system.",
            "price": Decimal("45000.00"),
            "image": "https://images.unsplash.com/photo-1473496169904-658ba7574b0d?w=400",
        },
        {
            "name": "Lindberg Air Titanium",
            "slug": "lindberg-air-titanium",
            "description": "Rimless titanium frame. Feather-light at under 2g.",
            "price": Decimal("68000.00"),
            "image": "https://images.unsplash.com/photo-1583394293214-6f8c22785e7c?w=400",
        },
        {
            "name": "Oakley Frogskins",
            "slug": "oakley-frogskins",
            "description": "Retro lifestyle frame with Three-Point Fit and Plutonite lenses.",
            "price": Decimal("22000.00"),
            "image": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400",
        },
    ]
    _create_products(frames_products, category_map["frames"])

    # ── Products — Laboratory Equipment ──────────────────────────────────────────
    print("Seeding Laboratory Equipment products...")
    lab_products = [
        {
            "name": "Digital Non-Contact Tonometer",
            "slug": "digital-nc-tonometer",
            "description": "Air-puff tonometer for IOP measurement. No anaesthetic required.",
            "price": Decimal("485000.00"),
            "image": "https://images.unsplash.com/photo-1579684453423-f84349ef60b0?w=400",
        },
        {
            "name": "LED Slit Lamp LS-5",
            "slug": "led-slit-lamp-ls5",
            "description": "5-step magnification slit lamp with integrated LED illumination.",
            "price": Decimal("1250000.00"),
            "image": "https://images.unsplash.com/photo-1583912267550-d974a65e0193?w=400",
        },
        {
            "name": "Auto Refractometer AR-200",
            "slug": "auto-refractometer-ar200",
            "description": "Automated refraction with keratometry for objective prescription measurement.",
            "price": Decimal("920000.00"),
            "image": "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400",
        },
        {
            "name": "Fundus Camera FC-10",
            "slug": "fundus-camera-fc10",
            "description": "50° field retinal camera with non-mydriatic imaging capability.",
            "price": Decimal("2100000.00"),
            "image": "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb?w=400",
        },
        {
            "name": "Trial Lens Set (266 pcs)",
            "slug": "trial-lens-set-266",
            "description": "Full optometric trial lens set in aluminium carry case.",
            "price": Decimal("185000.00"),
            "image": "https://images.unsplash.com/photo-1604782666037-3cd63d50052d?w=400",
        },
        {
            "name": "Lensometer LM-8",
            "slug": "lensometer-lm8",
            "description": "Digital focimeter for vertex power verification of finished lenses.",
            "price": Decimal("340000.00"),
            "image": "https://images.unsplash.com/photo-1581595220892-b0739db3ba8c?w=400",
        },
    ]
    _create_products(lab_products, category_map["laboratory-equipment"])

    print("\n✅ Seeding completed successfully!")
    print(f"  Categories: {StoreCategory.objects.count()}")
    print(f"  Products:   {Product.objects.count()}")
    print(f"  Frames:     {Frame.objects.count()}")
    print(f"  Lens Types: {LensType.objects.count()}")


def _create_products(products_data, category):
    for idx, p in enumerate(products_data):
        product = Product.objects.create(
            name=p["name"],
            slug=p["slug"],
            description=p["description"],
            category=category,
            price=p["price"],
            images=[p["image"]],
            quantity_available=50,
            low_stock_threshold=5,
            is_active=True,
        )
        ProductVariant.objects.create(
            product=product,
            variant_name="Standard",
            sku=f"{category.slug[:3].upper()}-{idx + 1:03d}",
            quantity_available=50,
            price_modifier=Decimal("0.00"),
        )
        print(f"  ✓ {p['name']}")


if __name__ == "__main__":
    seed()
