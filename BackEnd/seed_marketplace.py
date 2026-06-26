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

    print("Seeding Categories...")
    cats = [
        {"name": "Eyeglasses", "slug": "eyeglasses", "description": "Prescription frames and reading glasses"},
        {"name": "Sunglasses", "slug": "sunglasses", "description": "Stylish shades and UV protective eyewear"},
        {"name": "Contact Lenses", "slug": "contact-lenses", "description": "Soft, daily, or monthly contact lenses"},
        {"name": "Accessories", "slug": "accessories", "description": "Lens cases, cleaning kits, and repair items"},
    ]
    
    category_map = {}
    for c_data in cats:
        cat, _ = StoreCategory.objects.get_or_create(
            slug=c_data['slug'],
            defaults=c_data
        )
        category_map[c_data['slug']] = cat

    print("Seeding Lens Types...")
    lenses = [
        {"name": "Blue light filter", "description": "Protects eyes from digital screens blue light."},
        {"name": "Transitions", "description": "Light adaptive lenses that darken outdoors."},
        {"name": "High-index", "description": "Ultra thin lenses for high prescriptions."},
        {"name": "Polarized", "description": "Reduces glare for outdoor activities."},
        {"name": "Non-Prescription", "description": "Standard plano lenses."},
    ]
    
    lens_map = {}
    for l_data in lenses:
        lens, _ = LensType.objects.get_or_create(
            name=l_data['name'],
            defaults={
                "description": l_data['description'],
                "price_modifier": Decimal('0.00')
            }
        )
        lens_map[l_data['name']] = lens

    print("Seeding Lens Upgrades...")
    upgrades = [
        {"name": "Anti-Reflective Coating", "price_modifier": Decimal('15.00')},
        {"name": "Scratch Resistance", "price_modifier": Decimal('10.00')},
    ]
    for u_data in upgrades:
        LensOption.objects.get_or_create(
            name=u_data['name'],
            defaults={"price_modifier": u_data['price_modifier']}
        )

    print("Seeding Designer Frames...")
    # Seed Ray-ban Classic Wayfarer frame
    frame = Frame.objects.create(
        name="Classic Wayfarer",
        brand="Ray-ban",
        style="Wayfarer",
        material="Acetate",
        base_price=Decimal('25000.00'),
        front_image="https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400"
    )
    
    colors = ["Red", "Blue", "Purple", "Dark Grey"]
    sizes = ["Small", "Medium", "Large"]
    for color in colors:
        for size in sizes:
            FrameVariant.objects.create(
                frame=frame,
                color=color,
                size=size,
                quantity_available=20,
                sku=f"RB-WAY-{color[:3].upper()}-{size[:2].upper()}"
            )
            
    # Establish compatibility
    for lt in lens_map.values():
        FrameLensCompatibility.objects.get_or_create(
            frame=frame,
            lens_type=lt
        )

    print("Seeding Products (matching cards in Figma screenshot)...")
    
    # 10 Products with exact copy-paste Ray-ban details but varying category images
    product_data = [
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-1",
            "category": category_map["eyeglasses"],
            "image": "https://images.unsplash.com/photo-1574258495973-f010dfbb5371?w=400",
            "description": "Premium prescription frame. 50% OFF promotion active."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-2",
            "category": category_map["sunglasses"],
            "image": "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=400",
            "description": "UV protective designer sunglasses. Best Seller design."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-3",
            "category": category_map["contact-lenses"],
            "image": "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400",
            "description": "Daily disposable contact lenses. New Arrival item."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-4",
            "category": category_map["accessories"],
            "image": "https://images.unsplash.com/photo-1604782666037-3cd63d50052d?w=400",
            "description": "Premium hard protection travel case for glasses."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-5",
            "category": category_map["accessories"], # Mock supplement
            "image": "https://images.unsplash.com/photo-1616671285420-1a7776d65604?w=400",
            "description": "Advanced wellness formulation eye health pack."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-6",
            "category": category_map["accessories"], # Capsules
            "image": "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=400",
            "description": "Optimal eye health supplements capsules."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-7",
            "category": category_map["eyeglasses"],
            "image": "https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=400",
            "description": "Elegant lightweight prescription glasses frame."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-8",
            "category": category_map["accessories"],
            "image": "https://images.unsplash.com/photo-1607613009820-a29f7bb81c04?w=400",
            "description": "Special nora care eye relief drops and kit."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-9",
            "category": category_map["sunglasses"],
            "image": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400",
            "description": "Retro fashion wayfarer polarized sunglasses."
        },
        {
            "name": "Classic Wayfarer",
            "slug": "classic-wayfarer-10",
            "category": category_map["contact-lenses"],
            "image": "https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400",
            "description": "Breathable hydrogel monthly contact lenses."
        },
    ]

    for p_idx, p_data in enumerate(product_data):
        p = Product.objects.create(
            name=p_data['name'],
            slug=p_data['slug'],
            description=p_data['description'],
            category=p_data['category'],
            price=Decimal('12500.00'), # Sale Price
            images=[p_data['image']],
            quantity_available=50,
            low_stock_threshold=5,
            is_active=True
        )
        
        # Add a default variant
        ProductVariant.objects.create(
            product=p,
            variant_name="Standard Pack",
            sku=f"RB-WAY-PROD-{p_idx+1}",
            quantity_available=50,
            price_modifier=Decimal('0.00')
        )

    print("Seeding database completed successfully!")

if __name__ == "__main__":
    seed()
