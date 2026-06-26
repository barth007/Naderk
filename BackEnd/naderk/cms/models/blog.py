from django.db import models
from django.utils.text import slugify
from django.conf import settings
from .category import BlogCategory

class BlogPost(models.Model):
    class StatusChoices(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        ARCHIVED = 'archived', 'Archived'

    # Core Fields
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
    excerpt = models.TextField(blank=True)
    content = models.TextField()
    image_public_id = models.CharField(max_length=255, blank=True)
    image_url = models.URLField(max_length=1000, blank=True)
    
    status = models.CharField(
        max_length=20,
        choices=StatusChoices.choices,
        default=StatusChoices.DRAFT
    )
    published_at = models.DateTimeField(null=True, blank=True)
    is_featured = models.BooleanField(default=False)
    reading_time = models.CharField(max_length=50, blank=True)  # e.g., "5 min read"

    # Relationships
    category = models.ForeignKey(BlogCategory, on_delete=models.SET_NULL, null=True, related_name='posts')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='blog_posts')

    # SEO Fields
    meta_title = models.CharField(max_length=255, blank=True)
    meta_description = models.TextField(blank=True)
    meta_keywords = models.CharField(max_length=255, blank=True)

    # Analytics
    views_count = models.PositiveIntegerField(default=0)
    shares_count = models.PositiveIntegerField(default=0)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-published_at', '-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            # Generate unique slug
            original_slug = slugify(self.title)
            queryset = BlogPost.objects.all()
            if self.pk:
                queryset = queryset.exclude(pk=self.pk)
            slug = original_slug
            counter = 1
            while queryset.filter(slug=slug).exists():
                slug = f"{original_slug}-{counter}"
                counter += 1
            self.slug = slug
        
        # Calculate reading time if not set
        if not self.reading_time and self.content:
            word_count = len(self.content.split())
            minutes = max(1, word_count // 200) # Assuming 200 WPM
            self.reading_time = f"{minutes} min read"
            
        super().save(*args, **kwargs)
