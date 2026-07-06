from .base import *
from corsheaders.defaults import default_headers

DEBUG = False

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=['yourdomain.com'])

CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_HEADERS = list(default_headers) + [
    "idempotency-key",
]

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
