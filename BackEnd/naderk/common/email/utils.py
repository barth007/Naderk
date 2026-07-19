"""Small utilities that don't belong in services or providers."""

import re
import hmac
import hashlib
import logging

logger = logging.getLogger(__name__)


def strip_html(html: str) -> str:
    """Crude HTML-to-text for plain-text email fallback."""
    text = re.sub(r'<br\s*/?>', '\n', html, flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def verify_postmark_webhook(body: bytes, token: str, signature: str) -> bool:
    """
    Postmark sends an X-Postmark-Signature-256 header (HMAC-SHA256 of the raw body).
    token = settings.POSTMARK_WEBHOOK_TOKEN (set in Postmark dashboard → Webhooks → Auth).
    """
    expected = hmac.new(token.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


def safe_log_payload(payload: dict) -> dict:
    """Strip sensitive fields before storing webhook payload."""
    sensitive = {'password', 'token', 'secret', 'key', 'authorization'}
    return {k: v for k, v in payload.items() if k.lower() not in sensitive}
