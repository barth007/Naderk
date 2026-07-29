from django.urls import path
from .apis import (
    BlogListAPI, BlogDetailAPI, BlogCategoryListAPI,
    BlogCategoryCreateAPI, BlogCategoryDetailAPI,
    BlogCreateAPI, MyBlogListAPI, AllBlogListAPI,
    BlogUpdateDeleteAPI, BlogPublishAPI, BlogDraftAPI,
    HeroSlideListCreateApi, HeroSlideDetailApi,
    TestimonialListCreateApi, TestimonialDetailApi,
    TeamMemberListCreateApi, TeamMemberDetailApi,
    FAQListCreateApi, FAQDetailApi,
    TrustMetricListCreateApi, TrustMetricDetailApi,
    TrustedClientListCreateApi, TrustedClientDetailApi,
    SiteSettingsApi,
)

urlpatterns = [
    # Blog — public read
    path('blogs/', BlogListAPI.as_view(), name='blog-list'),

    # Categories — public read, admin write
    path('categories/', BlogCategoryListAPI.as_view(), name='category-list'),
    path('categories/create/', BlogCategoryCreateAPI.as_view(), name='category-create'),
    path('categories/<int:pk>/', BlogCategoryDetailAPI.as_view(), name='category-detail'),

    # Blog — authenticated write
    path('blogs/create/', BlogCreateAPI.as_view(), name='blog-create'),
    path('blogs/my/', MyBlogListAPI.as_view(), name='blog-my'),
    path('blogs/all/', AllBlogListAPI.as_view(), name='blog-all'),
    path('blogs/<int:pk>/', BlogUpdateDeleteAPI.as_view(), name='blog-update-delete'),
    path('blogs/<int:pk>/publish/', BlogPublishAPI.as_view(), name='blog-publish'),
    path('blogs/<int:pk>/draft/', BlogDraftAPI.as_view(), name='blog-draft'),

    # Blog — public detail (must come after specific int routes)
    path('blogs/<slug:slug>/', BlogDetailAPI.as_view(), name='blog-detail'),

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
