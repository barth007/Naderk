from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from naderk.common.responses.builders import build_success_response, build_error_response
from ..models import BlogPost, BlogCategory
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
from ..services.blog import create_blog_post, publish_blog_post, archive_blog_post

BLOG_AUTHOR_ROLES = {'DOCTOR', 'ADMIN', 'SUPER_ADMIN'}
ADMIN_ROLES = {'ADMIN', 'SUPER_ADMIN'}


def _serialize_blog_with_status(blog):
    return {
        'id': blog.id,
        'title': blog.title,
        'slug': blog.slug,
        'excerpt': blog.excerpt,
        'content': blog.content,
        'image_url': blog.image_url,
        'status': blog.status,
        'is_featured': blog.is_featured,
        'reading_time': blog.reading_time,
        'published_at': blog.published_at.isoformat() if blog.published_at else None,
        'category': {'id': blog.category.id, 'name': blog.category.name, 'slug': blog.category.slug} if blog.category else None,
        'author': {'id': blog.author.id, 'first_name': blog.author.first_name, 'last_name': blog.author.last_name} if blog.author else None,
        'meta_title': blog.meta_title,
        'meta_description': blog.meta_description,
        'meta_keywords': blog.meta_keywords,
        'views_count': blog.views_count,
        'created_at': blog.created_at.isoformat(),
        'updated_at': blog.updated_at.isoformat(),
    }

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


class BlogCategoryCreateAPI(APIView):
    """POST /cms/categories/ — create a category (Admin only)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in ADMIN_ROLES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="Only admins can manage categories.",
                instance=request.path,
            )
        name = str(request.data.get('name', '')).strip()
        description = str(request.data.get('description', '')).strip()
        if not name:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error", status_code=400,
                detail="name is required.", instance=request.path,
            )
        if BlogCategory.objects.filter(name__iexact=name).exists():
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/conflict",
                title="Conflict", status_code=409,
                detail="A category with this name already exists.", instance=request.path,
            )
        category = BlogCategory.objects.create(name=name, description=description)
        serializer = BlogCategorySerializer(category)
        return build_success_response(
            message="Category created successfully.",
            data=serializer.data, status_code=201,
        )


class BlogCategoryDetailAPI(APIView):
    """PUT/DELETE /cms/categories/<pk>/ — update or delete a category (Admin only)"""
    permission_classes = [IsAuthenticated]

    def _get_or_404(self, pk, request):
        if request.user.role not in ADMIN_ROLES:
            return None, build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="Only admins can manage categories.", instance=request.path,
            )
        try:
            return BlogCategory.objects.get(pk=pk), None
        except BlogCategory.DoesNotExist:
            return None, build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found", status_code=404,
                detail="Category not found.", instance=request.path,
            )

    def put(self, request, pk):
        category, err = self._get_or_404(pk, request)
        if err:
            return err
        name = str(request.data.get('name', category.name)).strip()
        description = str(request.data.get('description', category.description)).strip()
        if BlogCategory.objects.filter(name__iexact=name).exclude(pk=pk).exists():
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/conflict",
                title="Conflict", status_code=409,
                detail="A category with this name already exists.", instance=request.path,
            )
        category.name = name
        category.description = description
        category.save()
        return build_success_response(
            message="Category updated successfully.",
            data=BlogCategorySerializer(category).data,
        )

    def delete(self, request, pk):
        category, err = self._get_or_404(pk, request)
        if err:
            return err
        category.delete()
        return build_success_response(message="Category deleted successfully.", data={})


class BlogCreateAPI(APIView):
    """POST /cms/blogs/ — create a blog post (Doctor, Admin, Super Admin)"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role not in BLOG_AUTHOR_ROLES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden",
                status_code=403,
                detail="Only doctors and admins can create blog posts.",
                instance=request.path,
            )

        data = request.data
        title = str(data.get('title', '')).strip()
        content = str(data.get('content', '')).strip()
        if not title or not content:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="title and content are required.",
                instance=request.path,
            )

        category = None
        category_id = data.get('category_id')
        if category_id:
            try:
                category = BlogCategory.objects.get(id=category_id)
            except BlogCategory.DoesNotExist:
                return build_error_response(
                    type_uri="https://api.naderkeye.com/problems/not-found",
                    title="Not Found",
                    status_code=404,
                    detail="Category not found.",
                    instance=request.path,
                )

        kwargs = {
            'title': title,
            'content': content,
            'excerpt': str(data.get('excerpt', '')).strip(),
            'image_url': str(data.get('image_url', '')).strip(),
            'status': BlogPost.StatusChoices.DRAFT,
            'category': category,
            'meta_title': str(data.get('meta_title', '')).strip(),
            'meta_description': str(data.get('meta_description', '')).strip(),
            'meta_keywords': str(data.get('meta_keywords', '')).strip(),
        }

        if request.user.role in ADMIN_ROLES:
            kwargs['is_featured'] = bool(data.get('is_featured', False))

        blog = create_blog_post(author=request.user, **kwargs)

        if str(data.get('status', '')).upper() == 'PUBLISHED':
            blog = publish_blog_post(blog)

        return build_success_response(
            message="Blog post created successfully.",
            data=_serialize_blog_with_status(blog),
            status_code=201,
        )


class MyBlogListAPI(APIView):
    """GET /cms/blogs/my/ — list caller's own posts (all statuses)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in BLOG_AUTHOR_ROLES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden",
                status_code=403,
                detail="Only doctors and admins can access this endpoint.",
                instance=request.path,
            )
        blogs = BlogPost.objects.filter(author=request.user).select_related('category', 'author').order_by('-created_at')
        return build_success_response(
            message="Your blog posts retrieved successfully.",
            data={"results": [_serialize_blog_with_status(b) for b in blogs]},
        )


class AllBlogListAPI(APIView):
    """GET /cms/blogs/all/ — list ALL posts across all authors (Admin only)"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ADMIN_ROLES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden",
                status_code=403,
                detail="Admin access required.",
                instance=request.path,
            )
        blogs = BlogPost.objects.select_related('category', 'author').order_by('-created_at')
        return build_success_response(
            message="All blog posts retrieved successfully.",
            data={"results": [_serialize_blog_with_status(b) for b in blogs]},
        )


class BlogUpdateDeleteAPI(APIView):
    """PUT/DELETE /cms/blogs/<pk>/ — update or delete a blog post"""
    permission_classes = [IsAuthenticated]

    def _get_blog_or_403(self, request, pk):
        if request.user.role not in BLOG_AUTHOR_ROLES:
            return None, build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="Only doctors and admins can manage blog posts.",
                instance=request.path,
            )
        try:
            blog = BlogPost.objects.select_related('category', 'author').get(pk=pk)
        except BlogPost.DoesNotExist:
            return None, build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found", status_code=404,
                detail="Blog post not found.",
                instance=request.path,
            )
        if request.user.role not in ADMIN_ROLES and blog.author_id != request.user.id:
            return None, build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="You can only edit your own blog posts.",
                instance=request.path,
            )
        return blog, None

    def put(self, request, pk):
        blog, err = self._get_blog_or_403(request, pk)
        if err:
            return err

        data = request.data
        if 'title' in data:
            blog.title = str(data['title']).strip()
        if 'content' in data:
            blog.content = str(data['content']).strip()
        if 'excerpt' in data:
            blog.excerpt = str(data['excerpt']).strip()
        if 'image_url' in data:
            blog.image_url = str(data['image_url']).strip()
        if 'meta_title' in data:
            blog.meta_title = str(data['meta_title']).strip()
        if 'meta_description' in data:
            blog.meta_description = str(data['meta_description']).strip()
        if 'meta_keywords' in data:
            blog.meta_keywords = str(data['meta_keywords']).strip()
        if 'category_id' in data:
            try:
                blog.category = BlogCategory.objects.get(id=data['category_id']) if data['category_id'] else None
            except BlogCategory.DoesNotExist:
                pass
        if request.user.role in ADMIN_ROLES and 'is_featured' in data:
            blog.is_featured = bool(data['is_featured'])

        blog.reading_time = ''  # force recalc on save
        blog.save()

        return build_success_response(
            message="Blog post updated successfully.",
            data=_serialize_blog_with_status(blog),
        )

    def delete(self, request, pk):
        blog, err = self._get_blog_or_403(request, pk)
        if err:
            return err
        blog.delete()
        return build_success_response(message="Blog post deleted successfully.", data={})


class BlogPublishAPI(APIView):
    """POST /cms/blogs/<pk>/publish/ — publish a draft"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in BLOG_AUTHOR_ROLES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="Only doctors and admins can publish blog posts.",
                instance=request.path,
            )
        try:
            blog = BlogPost.objects.get(pk=pk)
        except BlogPost.DoesNotExist:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found", status_code=404,
                detail="Blog post not found.", instance=request.path,
            )
        if request.user.role not in ADMIN_ROLES and blog.author_id != request.user.id:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="You can only publish your own blog posts.", instance=request.path,
            )
        blog = publish_blog_post(blog)
        return build_success_response(
            message="Blog post published successfully.",
            data=_serialize_blog_with_status(blog),
        )


class BlogDraftAPI(APIView):
    """POST /cms/blogs/<pk>/draft/ — revert to draft"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if request.user.role not in BLOG_AUTHOR_ROLES:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="Only doctors and admins can manage blog posts.",
                instance=request.path,
            )
        try:
            blog = BlogPost.objects.get(pk=pk)
        except BlogPost.DoesNotExist:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/not-found",
                title="Not Found", status_code=404,
                detail="Blog post not found.", instance=request.path,
            )
        if request.user.role not in ADMIN_ROLES and blog.author_id != request.user.id:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/forbidden",
                title="Forbidden", status_code=403,
                detail="You can only manage your own blog posts.", instance=request.path,
            )
        blog.status = BlogPost.StatusChoices.DRAFT
        blog.save(update_fields=['status', 'updated_at'])
        return build_success_response(
            message="Blog post reverted to draft.",
            data=_serialize_blog_with_status(blog),
        )
