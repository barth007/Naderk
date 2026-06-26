from django.urls import path
from .apis import BlogListAPI, BlogDetailAPI, BlogCategoryListAPI

urlpatterns = [
    path('blogs/', BlogListAPI.as_view(), name='blog-list'),
    path('blogs/<slug:slug>/', BlogDetailAPI.as_view(), name='blog-detail'),
    path('categories/', BlogCategoryListAPI.as_view(), name='category-list'),
]
