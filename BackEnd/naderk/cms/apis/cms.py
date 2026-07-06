from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import get_user_model

from naderk.common.responses.builders import build_success_response, build_error_response
from ..models import HeroSlide, Testimonial, TeamMember, FAQ, TrustMetric, TrustedClient, SiteSettings

User = get_user_model()

ADMIN_ROLES = {'ADMIN', 'SUPER_ADMIN'}


def _is_admin(user):
    return getattr(user, 'role', None) in ADMIN_ROLES


# ── Serializer helpers (inline, lightweight) ────────────────────────────────

def _serialize_hero(obj):
    return {
        'id': obj.id,
        'badge_text': obj.badge_text,
        'title': obj.title,
        'subtitle': obj.subtitle,
        'description': obj.description,
        'image_url': obj.image_url,
        'cta_primary_text': obj.cta_primary_text,
        'cta_primary_link': obj.cta_primary_link,
        'cta_secondary_text': obj.cta_secondary_text,
        'cta_secondary_link': obj.cta_secondary_link,
        'discount_text': obj.discount_text,
        'theme': obj.theme,
        'order': obj.order,
        'is_active': obj.is_active,
    }


def _serialize_testimonial(obj):
    return {
        'id': obj.id,
        'name': obj.name,
        'role': obj.role,
        'company': obj.company,
        'location': obj.location,
        'quote': obj.quote,
        'rating': obj.rating,
        'image_url': obj.image_url,
        'order': obj.order,
        'is_active': obj.is_active,
    }


def _serialize_team(obj):
    return {
        'id': obj.id,
        'name': obj.name,
        'role': obj.role,
        'bio': obj.bio,
        'image_url': obj.image_url,
        'twitter_url': obj.twitter_url,
        'linkedin_url': obj.linkedin_url,
        'instagram_url': obj.instagram_url,
        'order': obj.order,
        'is_active': obj.is_active,
    }


def _serialize_faq(obj):
    return {
        'id': obj.id,
        'question': obj.question,
        'answer': obj.answer,
        'category': obj.category,
        'order': obj.order,
        'is_active': obj.is_active,
    }


def _serialize_trust_metric(obj):
    return {
        'id': obj.id,
        'label': obj.label,
        'value': obj.value,
        'icon': obj.icon,
        'order': obj.order,
        'is_active': obj.is_active,
    }


def _serialize_trusted_client(obj):
    return {
        'id': obj.id,
        'name': obj.name,
        'logo_url': obj.logo_url,
        'website': obj.website,
        'order': obj.order,
        'is_active': obj.is_active,
    }


def _serialize_site_settings(obj):
    return {
        'id': obj.id,
        'phone_primary': obj.phone_primary,
        'phone_secondary': obj.phone_secondary,
        'email_support': obj.email_support,
        'email_general': obj.email_general,
        'address': obj.address,
        'google_maps_url': obj.google_maps_url,
        'hours_weekday': obj.hours_weekday,
        'hours_saturday': obj.hours_saturday,
        'hours_sunday': obj.hours_sunday,
        'facebook_url': obj.facebook_url,
        'twitter_url': obj.twitter_url,
        'instagram_url': obj.instagram_url,
        'linkedin_url': obj.linkedin_url,
        'updated_at': obj.updated_at.isoformat() if obj.updated_at else None,
    }


# ── Generic mixin for list/create + detail/update/delete ────────────────────

class _CmsListCreateView(APIView):
    model = None
    serializer = None
    public_fields = None  # subset of writable fields for public reads (unused — all public)

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        qs = self.model.objects.filter(is_active=True)
        return build_success_response("Retrieved successfully", {"results": [self.serializer(o) for o in qs]})

    def post(self, request):
        if not _is_admin(request.user):
            return build_error_response("forbidden", "Access denied", 403, "Admin access required.")
        obj = self.model(**self._parse(request.data))
        obj.save()
        return build_success_response("Created successfully", self.serializer(obj), 201)

    def _parse(self, data):
        raise NotImplementedError


class _CmsDetailView(APIView):
    model = None
    serializer = None

    def get_permissions(self):
        return [IsAuthenticated()]

    def _get_obj(self, pk):
        try:
            return self.model.objects.get(pk=pk)
        except self.model.DoesNotExist:
            return None

    def put(self, request, pk):
        if not _is_admin(request.user):
            return build_error_response("forbidden", "Access denied", 403, "Admin access required.")
        obj = self._get_obj(pk)
        if not obj:
            return build_error_response("not-found", "Not found", 404, "Item not found.")
        for k, v in self._parse(request.data).items():
            setattr(obj, k, v)
        obj.save()
        return build_success_response("Updated successfully", self.serializer(obj))

    def delete(self, request, pk):
        if not _is_admin(request.user):
            return build_error_response("forbidden", "Access denied", 403, "Admin access required.")
        obj = self._get_obj(pk)
        if not obj:
            return build_error_response("not-found", "Not found", 404, "Item not found.")
        obj.delete()
        return build_success_response("Deleted successfully", {})

    def _parse(self, data):
        raise NotImplementedError


# ── Hero Slides ──────────────────────────────────────────────────────────────

def _parse_hero(data):
    return {
        'badge_text': data.get('badge_text', ''),
        'title': data.get('title', ''),
        'subtitle': data.get('subtitle', ''),
        'description': data.get('description', ''),
        'image_url': data.get('image_url', ''),
        'cta_primary_text': data.get('cta_primary_text', ''),
        'cta_primary_link': data.get('cta_primary_link', ''),
        'cta_secondary_text': data.get('cta_secondary_text', ''),
        'cta_secondary_link': data.get('cta_secondary_link', ''),
        'discount_text': data.get('discount_text', ''),
        'theme': data.get('theme', 'LIGHT'),
        'order': data.get('order', 0),
        'is_active': data.get('is_active', True),
    }


class HeroSlideListCreateApi(_CmsListCreateView):
    model = HeroSlide
    serializer = staticmethod(_serialize_hero)

    def get(self, request):
        qs = HeroSlide.objects.filter(is_active=True)
        return build_success_response("Retrieved successfully", {"results": [_serialize_hero(o) for o in qs]})

    def _parse(self, data):
        return _parse_hero(data)


class HeroSlideDetailApi(_CmsDetailView):
    model = HeroSlide
    serializer = staticmethod(_serialize_hero)

    def _parse(self, data):
        return _parse_hero(data)


# ── Testimonials ─────────────────────────────────────────────────────────────

def _parse_testimonial(data):
    return {
        'name': data.get('name', ''),
        'role': data.get('role', ''),
        'company': data.get('company', ''),
        'location': data.get('location', ''),
        'quote': data.get('quote', ''),
        'rating': int(data.get('rating', 5)),
        'image_url': data.get('image_url', ''),
        'order': int(data.get('order', 0)),
        'is_active': data.get('is_active', True),
    }


class TestimonialListCreateApi(_CmsListCreateView):
    model = Testimonial
    serializer = staticmethod(_serialize_testimonial)

    def get(self, request):
        qs = Testimonial.objects.filter(is_active=True)
        return build_success_response("Retrieved successfully", {"results": [_serialize_testimonial(o) for o in qs]})

    def _parse(self, data):
        return _parse_testimonial(data)


class TestimonialDetailApi(_CmsDetailView):
    model = Testimonial
    serializer = staticmethod(_serialize_testimonial)

    def _parse(self, data):
        return _parse_testimonial(data)


# ── Team Members ─────────────────────────────────────────────────────────────

def _parse_team(data):
    return {
        'name': data.get('name', ''),
        'role': data.get('role', ''),
        'bio': data.get('bio', ''),
        'image_url': data.get('image_url', ''),
        'twitter_url': data.get('twitter_url', ''),
        'linkedin_url': data.get('linkedin_url', ''),
        'instagram_url': data.get('instagram_url', ''),
        'order': int(data.get('order', 0)),
        'is_active': data.get('is_active', True),
    }


class TeamMemberListCreateApi(_CmsListCreateView):
    model = TeamMember
    serializer = staticmethod(_serialize_team)

    def get(self, request):
        qs = TeamMember.objects.filter(is_active=True)
        return build_success_response("Retrieved successfully", {"results": [_serialize_team(o) for o in qs]})

    def _parse(self, data):
        return _parse_team(data)


class TeamMemberDetailApi(_CmsDetailView):
    model = TeamMember
    serializer = staticmethod(_serialize_team)

    def _parse(self, data):
        return _parse_team(data)


# ── FAQs ─────────────────────────────────────────────────────────────────────

def _parse_faq(data):
    return {
        'question': data.get('question', ''),
        'answer': data.get('answer', ''),
        'category': data.get('category', ''),
        'order': int(data.get('order', 0)),
        'is_active': data.get('is_active', True),
    }


class FAQListCreateApi(_CmsListCreateView):
    model = FAQ
    serializer = staticmethod(_serialize_faq)

    def get(self, request):
        qs = FAQ.objects.filter(is_active=True)
        return build_success_response("Retrieved successfully", {"results": [_serialize_faq(o) for o in qs]})

    def _parse(self, data):
        return _parse_faq(data)


class FAQDetailApi(_CmsDetailView):
    model = FAQ
    serializer = staticmethod(_serialize_faq)

    def _parse(self, data):
        return _parse_faq(data)


# ── Trust Metrics ────────────────────────────────────────────────────────────

def _parse_trust_metric(data):
    return {
        'label': data.get('label', ''),
        'value': data.get('value', ''),
        'icon': data.get('icon', ''),
        'order': int(data.get('order', 0)),
        'is_active': data.get('is_active', True),
    }


class TrustMetricListCreateApi(_CmsListCreateView):
    model = TrustMetric
    serializer = staticmethod(_serialize_trust_metric)

    def get(self, request):
        qs = TrustMetric.objects.filter(is_active=True)
        return build_success_response("Retrieved successfully", {"results": [_serialize_trust_metric(o) for o in qs]})

    def _parse(self, data):
        return _parse_trust_metric(data)


class TrustMetricDetailApi(_CmsDetailView):
    model = TrustMetric
    serializer = staticmethod(_serialize_trust_metric)

    def _parse(self, data):
        return _parse_trust_metric(data)


# ── Trusted Clients ──────────────────────────────────────────────────────────

def _parse_trusted_client(data):
    return {
        'name': data.get('name', ''),
        'logo_url': data.get('logo_url', ''),
        'website': data.get('website', ''),
        'order': int(data.get('order', 0)),
        'is_active': data.get('is_active', True),
    }


class TrustedClientListCreateApi(_CmsListCreateView):
    model = TrustedClient
    serializer = staticmethod(_serialize_trusted_client)

    def get(self, request):
        qs = TrustedClient.objects.filter(is_active=True)
        return build_success_response("Retrieved successfully", {"results": [_serialize_trusted_client(o) for o in qs]})

    def _parse(self, data):
        return _parse_trusted_client(data)


class TrustedClientDetailApi(_CmsDetailView):
    model = TrustedClient
    serializer = staticmethod(_serialize_trusted_client)

    def _parse(self, data):
        return _parse_trusted_client(data)


# ── Site Settings (singleton) ────────────────────────────────────────────────

class SiteSettingsApi(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        obj = SiteSettings.objects.first()
        if not obj:
            return build_success_response("No settings configured", {})
        return build_success_response("Retrieved successfully", _serialize_site_settings(obj))

    def put(self, request):
        if not _is_admin(request.user):
            return build_error_response("forbidden", "Access denied", 403, "Admin access required.")
        obj = SiteSettings.objects.first() or SiteSettings()
        fields = [
            'phone_primary', 'phone_secondary', 'email_support', 'email_general',
            'address', 'google_maps_url', 'hours_weekday', 'hours_saturday', 'hours_sunday',
            'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url',
        ]
        for f in fields:
            if f in request.data:
                setattr(obj, f, request.data[f])
        obj.save()
        return build_success_response("Settings updated successfully", _serialize_site_settings(obj))
