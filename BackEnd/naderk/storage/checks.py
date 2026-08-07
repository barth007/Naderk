"""
Deploy-time guards for object storage configuration.

Uploaded images are stored with an absolute URL built from
`MINIO_PUBLIC_ENDPOINT`. If that still points at an internal or local address
in a deployed environment, every upload is written with a URL no browser can
reach — product photos, frame photos, and the site logo all silently render as
broken images, with nothing in the logs to explain it. These checks turn that
into a loud startup error instead.
"""
import sys
from urllib.parse import urlparse

from django.conf import settings
from django.core.checks import Error, Warning, register

INTERNAL_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0', 'minio', '::1'}


@register('storage')
def check_public_storage_endpoint(app_configs, **kwargs):
    issues = []
    cfg = getattr(settings, 'STORAGE', {})
    public = cfg.get('PUBLIC_ENDPOINT') or ''
    parsed = urlparse(public)
    host = (parsed.hostname or '').lower()

    # Django forces DEBUG=False under the test runner, which would otherwise
    # make every local test run fail on a deployment-only concern.
    if settings.DEBUG or 'test' in sys.argv:
        return issues

    if not public:
        issues.append(Error(
            'MINIO_PUBLIC_ENDPOINT is not set.',
            hint='Set it to the browser-reachable HTTPS URL that serves your '
                 'public bucket, e.g. https://media.example.com',
            id='storage.E001',
        ))
        return issues

    if host in INTERNAL_HOSTS:
        issues.append(Error(
            f'MINIO_PUBLIC_ENDPOINT points at "{host}", which browsers cannot reach.',
            hint='Uploaded images are saved with this as their URL prefix, so every '
                 'product image, frame image, and the site logo will be broken. Set '
                 'MINIO_PUBLIC_ENDPOINT to a public URL.',
            id='storage.E002',
        ))
    elif parsed.scheme != 'https':
        issues.append(Warning(
            f'MINIO_PUBLIC_ENDPOINT uses {parsed.scheme or "no"} scheme, not https.',
            hint='An http:// image URL on an https:// page is blocked as mixed '
                 'content, so images will not render.',
            id='storage.W001',
        ))

    return issues
