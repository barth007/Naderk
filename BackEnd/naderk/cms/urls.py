from django.urls import path
from .apis import (
    BlogListAPI, BlogDetailAPI, BlogCategoryListAPI,
    HeroSlideListCreateApi, HeroSlideDetailApi,
    TestimonialListCreateApi, TestimonialDetailApi,
    TeamMemberListCreateApi, TeamMemberDetailApi,
    FAQListCreateApi, FAQDetailApi,
    TrustMetricListCreateApi, TrustMetricDetailApi,
    TrustedClientListCreateApi, TrustedClientDetailApi,
    SiteSettingsApi,
)

urlpatterns = [
    # Blog (existing)
    path('blogs/', BlogListAPI.as_view(), name='blog-list'),
    path('blogs/<slug:slug>/', BlogDetailAPI.as_view(), name='blog-detail'),
    path('categories/', BlogCategoryListAPI.as_view(), name='category-list'),

    # Hero slides
    path('hero-slides/', HeroSlideListCreateApi.as_view(), name='hero-slide-list'),
    path('hero-slides/<int:pk>/', HeroSlideDetailApi.as_view(), name='hero-slide-detail'),

    # Testimonials
    path('testimonials/', TestimonialListCreateApi.as_view(), name='testimonial-list'),
    path('testimonials/<int:pk>/', TestimonialDetailApi.as_view(), name='testimonial-detail'),

    # Team members
    path('team/', TeamMemberListCreateApi.as_view(), name='team-list'),
    path('team/<int:pk>/', TeamMemberDetailApi.as_view(), name='team-detail'),

    # FAQs
    path('faqs/', FAQListCreateApi.as_view(), name='faq-list'),
    path('faqs/<int:pk>/', FAQDetailApi.as_view(), name='faq-detail'),

    # Trust metrics
    path('trust-metrics/', TrustMetricListCreateApi.as_view(), name='trust-metric-list'),
    path('trust-metrics/<int:pk>/', TrustMetricDetailApi.as_view(), name='trust-metric-detail'),

    # Trusted clients
    path('trusted-clients/', TrustedClientListCreateApi.as_view(), name='trusted-client-list'),
    path('trusted-clients/<int:pk>/', TrustedClientDetailApi.as_view(), name='trusted-client-detail'),

    # Site settings (singleton)
    path('site-settings/', SiteSettingsApi.as_view(), name='site-settings'),
]
