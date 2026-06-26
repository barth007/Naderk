from django.urls import path
from .apis import (
    CategoryListApi, ProductListApi, ProductDetailApi, FrameListApi, FrameDetailApi,
    LensTypeListApi, LensOptionListApi, PrescriptionListCreateApi, PrescriptionReusableListApi,
    PrescriptionDetailApi, PrescriptionReviewQueueApi, PrescriptionReviewActionApi,
    CartDetailApi, CartAddItemApi, CartUpdateQuantityApi, CartRemoveItemApi, CartClearApi,
    WishlistDetailApi, WishlistToggleItemApi, CheckoutApi, OrderListApi, OrderDetailApi,
    OrderPaymentApi, OrderReviewQueueApi, OrderPrescriptionReviewApi
)

app_name = 'ecommerce'

urlpatterns = [
    # General Catalog
    path('categories/', CategoryListApi.as_view(), name='category-list'),
    path('products/', ProductListApi.as_view(), name='product-list'),
    path('products/<uuid:pk>/', ProductDetailApi.as_view(), name='product-detail'),

    # Eyewear Specs
    path('frames/', FrameListApi.as_view(), name='frame-list'),
    path('frames/<uuid:pk>/', FrameDetailApi.as_view(), name='frame-detail'),
    path('lens-types/', LensTypeListApi.as_view(), name='lens-type-list'),
    path('lens-options/', LensOptionListApi.as_view(), name='lens-option-list'),

    # Prescriptions & Approval Workflow
    path('prescriptions/', PrescriptionListCreateApi.as_view(), name='prescription-list-create'),
    path('prescriptions/reusable/', PrescriptionReusableListApi.as_view(), name='prescription-reusable-list'),
    path('prescriptions/<uuid:pk>/', PrescriptionDetailApi.as_view(), name='prescription-detail'),
    path('prescriptions/review-queue/', PrescriptionReviewQueueApi.as_view(), name='prescription-review-queue'),
    path('prescriptions/<uuid:pk>/review/', PrescriptionReviewActionApi.as_view(), name='prescription-review-action'),

    # Carts & Wishlists
    path('cart/', CartDetailApi.as_view(), name='cart-detail'),
    path('cart/add/', CartAddItemApi.as_view(), name='cart-add'),
    path('cart/update-quantity/', CartUpdateQuantityApi.as_view(), name='cart-update-quantity'),
    path('cart/remove/', CartRemoveItemApi.as_view(), name='cart-remove'),
    path('cart/clear/', CartClearApi.as_view(), name='cart-clear'),

    path('wishlist/', WishlistDetailApi.as_view(), name='wishlist-detail'),
    path('wishlist/toggle/', WishlistToggleItemApi.as_view(), name='wishlist-toggle'),

    # Checkout & Orders
    path('checkout/', CheckoutApi.as_view(), name='checkout'),
    path('orders/', OrderListApi.as_view(), name='order-list'),
    path('orders/review-queue/', OrderReviewQueueApi.as_view(), name='order-review-queue'),
    path('orders/<uuid:pk>/', OrderDetailApi.as_view(), name='order-detail'),
    path('orders/<uuid:pk>/pay/', OrderPaymentApi.as_view(), name='order-pay'),
    path('orders/<uuid:pk>/review/', OrderPrescriptionReviewApi.as_view(), name='order-prescription-review'),
]
