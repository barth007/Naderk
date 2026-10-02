from rest_framework import serializers
from ..models import BlogPost
from .category import BlogCategorySerializer

class AuthorSerializer(serializers.Serializer):
    # User ids are UUIDs. As an IntegerField this came out as a 39-digit number
    # that JavaScript rounds, so the id the browser held matched no user.
    id = serializers.UUIDField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()

class BlogPostListSerializer(serializers.ModelSerializer):
    category = BlogCategorySerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    
    class Meta:
        model = BlogPost
        fields = [
            'id', 'title', 'slug', 'excerpt', 'image_url',
            'published_at', 'is_featured', 'reading_time',
            'category', 'author', 'views_count'
        ]

class BlogPostDetailSerializer(serializers.ModelSerializer):
    category = BlogCategorySerializer(read_only=True)
    author = AuthorSerializer(read_only=True)
    
    class Meta:
        model = BlogPost
        fields = [
            'id', 'title', 'slug', 'excerpt', 'content', 'image_url',
            'published_at', 'is_featured', 'reading_time',
            'category', 'author', 'meta_title', 'meta_description', 
            'meta_keywords', 'views_count', 'shares_count',
            'created_at', 'updated_at'
        ]
