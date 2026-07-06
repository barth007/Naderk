from django import forms
from django.contrib import admin
from naderk.common.storage.service import storage_service
from ..models import BlogPost


class BlogPostForm(forms.ModelForm):
    image_upload = forms.FileField(
        required=False,
        help_text="Upload an image to storage. This will overwrite the current image URL."
    )

    class Meta:
        model = BlogPost
        fields = '__all__'

    def save(self, commit=True):
        instance = super().save(commit=False)
        image_upload = self.cleaned_data.get('image_upload')

        if image_upload:
            result = storage_service.upload_file(image_upload, bucket_type='public', prefix='blog')
            instance.image_url = result.url
            instance.image_public_id = result.object_key

        if commit:
            instance.save()
        return instance

@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    form = BlogPostForm
    list_display = ['title', 'category', 'status', 'is_featured', 'published_at', 'views_count']
    list_filter = ['status', 'is_featured', 'category', 'created_at']
    search_fields = ['title', 'excerpt', 'content', 'meta_title']
    prepopulated_fields = {'slug': ('title',)}
    autocomplete_fields = ['category']
    date_hierarchy = 'published_at'
    
    fieldsets = (
        ('Core Content', {
            'fields': ('title', 'slug', 'category', 'excerpt', 'content', 'author')
        }),
        ('Media', {
            'fields': ('image_upload', 'image_url', 'image_public_id')
        }),
        ('Publishing', {
            'fields': ('status', 'is_featured', 'published_at', 'reading_time')
        }),
        ('SEO Metadata', {
            'fields': ('meta_title', 'meta_description', 'meta_keywords'),
            'classes': ('collapse',)
        }),
        ('Analytics', {
            'fields': ('views_count', 'shares_count'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('views_count', 'shares_count', 'image_url', 'image_public_id')
