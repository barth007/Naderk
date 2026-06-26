from django.db.models import QuerySet, Q
from ..models import BlogPost

def get_published_blogs() -> QuerySet[BlogPost]:
    return BlogPost.objects.filter(status=BlogPost.StatusChoices.PUBLISHED).select_related('category', 'author')

def get_featured_blogs() -> QuerySet[BlogPost]:
    return get_published_blogs().filter(is_featured=True)

def get_blog_by_slug(slug: str) -> BlogPost:
    return get_published_blogs().get(slug=slug)

def get_related_posts(category_id: int, exclude_id: int, limit: int = 3) -> QuerySet[BlogPost]:
    return get_published_blogs().filter(category_id=category_id).exclude(id=exclude_id)[:limit]

def search_blogs(query: str = None, category_slug: str = None, featured: bool = None) -> QuerySet[BlogPost]:
    qs = get_published_blogs()
    
    if query:
        qs = qs.filter(
            Q(title__icontains=query) | 
            Q(excerpt__icontains=query) |
            Q(content__icontains=query)
        )
        
    if category_slug:
        qs = qs.filter(category__slug=category_slug)
        
    if featured is not None:
        qs = qs.filter(is_featured=featured)
        
    return qs
