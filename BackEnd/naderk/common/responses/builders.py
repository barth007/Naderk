from django.conf import settings
from rest_framework.response import Response


def _problems_url(slug: str) -> str:
    """Build a full RFC 7807 type URI from just the problem slug."""
    base = getattr(settings, 'API_BASE_URL', 'http://localhost:8000').rstrip('/')
    return f"{base}/problems/{slug}"


def build_success_response(message: str, data: dict = None, status_code: int = 200) -> Response:
    payload = {
        "success": True,
        "message": message,
    }
    if data is not None:
        payload["data"] = data
    return Response(payload, status=status_code)


def build_error_response(
    type_uri: str,
    title: str,
    status_code: int,
    detail: str,
    instance: str = None,
    errors: dict = None,
) -> Response:
    """
    Builds a standardized RFC 7807 problem details error response.

    `type_uri` can be either:
      - a full URL  → used as-is  (legacy callsites)
      - a slug only → prefixed with settings.API_BASE_URL automatically
    """
    if not type_uri.startswith('http'):
        type_uri = _problems_url(type_uri)

    payload = {
        "type": type_uri,
        "title": title,
        "status": status_code,
        "detail": detail,
    }
    if instance:
        payload["instance"] = instance
    if errors:
        payload["errors"] = errors
    return Response(payload, status=status_code)
