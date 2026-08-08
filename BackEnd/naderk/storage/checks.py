"""
Configuration guards for object storage.

Uploaded images are stored with an absolute URL built from
`MINIO_PUBLIC_ENDPOINT`. If that still points at an internal or local address
in a deployed environment, every upload is written with a URL no browser can
reach — product photos, frame photos, and the site logo all silently render as
broken images, with nothing in the logs to explain it.

These are deliberately **warnings, not errors**. Django aborts `migrate` (and
therefore container startup) when a check reports ERROR, so an earlier version
of this file took the entire backend down over an image-URL problem: the web
container crash-looped and never became healthy. Broken images are bad; an API
outage that also takes down auth, appointments and payments is far worse.

Run `manage.py check --deploy --fail-level WARNING` in CI if you want these to
block a release rather than just be shouted about at startup.
"""
import sys
from urllib.parse import urlparse

from django.conf import settings
from django.core.checks import Warning, register

INTERNAL_HOSTS = {'localhost', '127.0.0.1', '0.0.0.0', 'minio', '::1'}


@register('storage')
def check_public_storage_endpoint(app_configs, **kwargs):
    issues = []
    cfg = getattr(settings, 'STORAGE', {})
    public = cfg.get('PUBLIC_ENDPOINT') or ''
    parsed = urlparse(public)
    host = (parsed.hostname or '').lower()

    # Django forces DEBUG=False under the test runner, which would otherwise
    # make every local test run noisy about a deployment-only concern.
    if settings.DEBUG or 'test' in sys.argv:
        return issues

    if not public:
        issues.append(Warning(
            'MINIO_PUBLIC_ENDPOINT is not set — uploaded images will not load.',
            hint='Set it to the browser-reachable HTTPS URL that serves your '
                 'public bucket, e.g. https://media.example.com',
            id='storage.W002',
        ))
        return issues

    if host in INTERNAL_HOSTS:
        issues.append(Warning(
            f'MINIO_PUBLIC_ENDPOINT points at "{host}", which browsers cannot reach.',
            hint='Uploaded images are saved with this as their URL prefix, so every '
                 'product image, frame image, and the site logo will be broken. Set '
                 'MINIO_PUBLIC_ENDPOINT to a public URL. The API still runs.',
            id='storage.W003',
        ))
    elif parsed.scheme != 'https':
        issues.append(Warning(
            f'MINIO_PUBLIC_ENDPOINT uses {parsed.scheme or "no"} scheme, not https.',
            hint='An http:// image URL on an https:// page is blocked as mixed '
                 'content, so images will not render.',
            id='storage.W001',
        ))

    return issues
