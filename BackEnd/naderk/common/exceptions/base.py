from django.conf import settings
from rest_framework.exceptions import APIException


def _problems_url(slug: str) -> str:
    base = getattr(settings, 'API_BASE_URL', 'http://localhost:8000').rstrip('/')
    return f"{base}/problems/{slug}"


class BaseCustomException(APIException):
    status_code = 500
    default_detail = 'A server error occurred.'
    default_code = 'error'
    default_type_slug = 'server-error'
    default_title = 'Server Error'

    def __init__(self, detail=None, code=None, type_uri=None, title=None, errors=None):
        self.detail = detail if detail is not None else self.default_detail
        self.code = code if code is not None else self.default_code
        self.title = title or self.default_title
        self.errors = errors

        if type_uri:
            self.type_uri = type_uri
        else:
            # Build from slug using the current environment's API_BASE_URL
            slug = getattr(self, 'default_type_slug', 'server-error')
            self.type_uri = _problems_url(slug)
