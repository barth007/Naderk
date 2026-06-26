from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny
from naderk.common.responses.builders import build_success_response
from ..models import BlogCategory
from ..serializers import (
    BlogCategorySerializer,
    BlogPostListSerializer,
    BlogPostDetailSerializer
)
from ..selectors import (
    search_blogs,
    get_featured_blogs,
    get_blog_by_slug
)

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

class BlogListAPI(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        query = request.query_params.get('search', None)
        category_slug = request.query_params.get('category', None)
        featured_str = request.query_params.get('featured', None)
        
        featured = None
        if featured_str is not None:
            featured = featured_str.lower() == 'true'
            
        blogs = search_blogs(query=query, category_slug=category_slug, featured=featured)
        
        paginator = StandardResultsSetPagination()
        paginated_blogs = paginator.paginate_queryset(blogs, request)
        
        serializer = BlogPostListSerializer(paginated_blogs, many=True)
        
        return paginator.get_paginated_response(serializer.data)
        
    def get_paginated_response(self, paginator, data):
        return build_success_response(
            message="Blogs retrieved successfully",
            data={
                "count": paginator.page.paginator.count,
                "next": paginator.get_next_link(),
                "previous": paginator.get_previous_link(),
                "results": data
            }
        )

# Override pagination response to match our standardized format
def get_paginated_response(self, data):
    return build_success_response(
        message="Blogs retrieved successfully",
        data={
            "count": self.page.paginator.count,
            "next": self.get_next_link(),
            "previous": self.get_previous_link(),
            "results": data
        }
    )
StandardResultsSetPagination.get_paginated_response = get_paginated_response

class BlogDetailAPI(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, slug, *args, **kwargs):
        try:
            blog = get_blog_by_slug(slug)
        except Exception:
            from naderk.common.exceptions.custom_exceptions import NotFoundException
            raise NotFoundException("Blog post not found.")
            
        # Increment view count
        from ..services.blog import increment_blog_views
        increment_blog_views(blog)
        
        serializer = BlogPostDetailSerializer(blog)
        
        return build_success_response(
            message="Blog retrieved successfully",
            data=serializer.data
        )

class BlogCategoryListAPI(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, *args, **kwargs):
        categories = BlogCategory.objects.all()
        serializer = BlogCategorySerializer(categories, many=True)
        return build_success_response(
            message="Categories retrieved successfully",
            data={"results": serializer.data}
        )
