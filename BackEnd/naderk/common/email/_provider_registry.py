"""
Lazily instantiated provider singletons.
Tasks import from here to avoid re-creating provider objects on every call.
"""

from django.conf import settings
from .exceptions import EmailConfigurationError

_instances: dict = {}


def get_provider(name: str | None = None):
    provider_name = (name or getattr(settings, 'EMAIL_PROVIDER', 'smtp')).lower()

    if provider_name not in _instances:
        _instances[provider_name] = _build(provider_name)

    return _instances[provider_name]


def _build(name: str):
    if name == 'postmark':
        from .providers.postmark import PostmarkProvider
        return PostmarkProvider()
    if name == 'resend':
        from .providers.resend import ResendProvider
        return ResendProvider()
    if name == 'ses':
        from .providers.ses import SESProvider
        return SESProvider()
    if name == 'smtp':
        from .providers.smtp import SMTPProvider
        return SMTPProvider()
    raise EmailConfigurationError(
        f"Unknown EMAIL_PROVIDER '{name}'. Valid options: postmark, smtp, resend, ses"
    )
