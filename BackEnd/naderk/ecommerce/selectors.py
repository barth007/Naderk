from django.db.models import Q, QuerySet
from django.contrib.auth import get_user_model
from typing import Optional, List
from .models import (
    StoreCategory, Product, Frame, LensType, LensOption,
    Prescription, Cart, Wishlist, Order
)

User = get_user_model()

def get_active_categories() -> QuerySet:
    return StoreCategory.objects.all()

def get_products(*, category_slug: Optional[str] = None, search_query: Optional[str] = None, sort_by: Optional[str] = None) -> QuerySet:
    queryset = Product.objects.filter(is_active=True).prefetch_related('variants')
    
    if category_slug:
        # Support filtering by the category or its subcategories
        queryset = queryset.filter(
            Q(category__slug=category_slug) | Q(category__parent__slug=category_slug)
        )
        
    if search_query:
        queryset = queryset.filter(
            Q(name__icontains=search_query) | Q(description__icontains=search_query)
        )
        
    if sort_by:
        # Map sorting strings to fields
        sort_mapping = {
            'price_asc': 'price',
            'price_desc': '-price',
            'name_asc': 'name',
            'name_desc': '-name',
            'newest': '-created_at',
        }
        order_field = sort_mapping.get(sort_by)
        if order_field:
            queryset = queryset.order_by(order_field)
            
    return queryset

def get_frames(*, search_query: Optional[str] = None, brand: Optional[str] = None) -> QuerySet:
    queryset = Frame.objects.filter(is_active=True).prefetch_related('variants', 'compatibilities')

    if search_query:
        queryset = queryset.filter(
            Q(name__icontains=search_query) |
            Q(brand__icontains=search_query) |
            Q(style__icontains=search_query) |
            Q(material__icontains=search_query)
        )

    if brand:
        queryset = queryset.filter(brand__iexact=brand)

    return queryset

def get_lens_types() -> QuerySet:
    return LensType.objects.filter(is_active=True)

def get_lens_options() -> QuerySet:
    return LensOption.objects.filter(is_active=True)

def get_prescriptions_for_optician() -> QuerySet:
    # Opticians review pending and under_review prescriptions
    return Prescription.objects.filter(
        status__in=[Prescription.Status.PENDING_REVIEW, Prescription.Status.UNDER_REVIEW]
    ).select_related('patient').order_by('-created_at')

def get_prescriptions_for_patient(user: User) -> QuerySet:
    return Prescription.objects.filter(patient=user).order_by('-created_at')

def get_user_cart(user: User) -> Cart:
    cart, _ = Cart.objects.get_or_create(user=user)
    return cart

def get_user_wishlist(user: User) -> Wishlist:
    wishlist, _ = Wishlist.objects.get_or_create(user=user)
    return wishlist

def get_user_orders(user: User) -> QuerySet:
    return Order.objects.filter(user=user).prefetch_related('items', 'activities').order_by('-created_at')
