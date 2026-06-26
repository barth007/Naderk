from django.utils import timezone
from ..models import BlogPost
from naderk.core.models import User

def create_blog_post(author: User, **kwargs) -> BlogPost:
    blog = BlogPost(author=author, **kwargs)
    blog.full_clean()
    blog.save()
    return blog

def publish_blog_post(blog: BlogPost) -> BlogPost:
    blog.status = BlogPost.StatusChoices.PUBLISHED
    if not blog.published_at:
        blog.published_at = timezone.now()
    blog.save(update_fields=['status', 'published_at', 'updated_at'])
    return blog

def archive_blog_post(blog: BlogPost) -> BlogPost:
    blog.status = BlogPost.StatusChoices.ARCHIVED
    blog.save(update_fields=['status', 'updated_at'])
    return blog

def increment_blog_views(blog: BlogPost) -> BlogPost:
    blog.views_count += 1
    blog.save(update_fields=['views_count'])
    return blog
