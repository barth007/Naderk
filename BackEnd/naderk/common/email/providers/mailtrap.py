"""
Mailtrap email provider.

Uses Mailtrap's Email Sending HTTP API (https://api-docs.mailtrap.io/).
Sending domain DNS (SPF/DKIM/DMARC) must be verified in the Mailtrap dashboard.

Required settings / env vars:
    EMAIL_MAILTRAP_API_TOKEN   – API token from the Mailtrap dashboard
    DEFAULT_FROM_EMAIL         – sender address on a verified domain,
                                 e.g. "NaderkEye Care <notification@naderela.com>"
Optional:
    EMAIL_MAILTRAP_SANDBOX     – "true" to route through a test inbox instead of
                                 delivering real mail (default: false)
    EMAIL_MAILTRAP_INBOX_ID    – inbox id, required when sandbox is enabled
    DEFAULT_REPLY_TO_EMAIL     – reply-to override
"""

import base64
import logging
from email.utils import getaddresses, parseaddr
from typing import Optional

import requests
from django.conf import settings

from .base import EmailMessage, EmailProvider
from ..exceptions import EmailConfigurationError, EmailDeliveryError, EmailProviderError

logger = logging.getLogger(__name__)

_MAILTRAP_SEND_URL = 'https://send.api.mailtrap.io/api/send'
_MAILTRAP_SANDBOX_URL = 'https://sandbox.api.mailtrap.io/api/send/{inbox_id}'


def _address(value: str) -> Optional[dict]:
    """Parse "Name <email>" / "email" into Mailtrap's {email, name} object."""
    if not value:
        return None
    name, email = parseaddr(value)
    if not email:
        return None
    addr = {'email': email}
    if name:
        addr['name'] = name
    return addr


def _address_list(values) -> list:
    """Parse a list of addresses (each "Name <email>" or "email") for Mailtrap."""
    result = []
    for name, email in getaddresses(list(values or [])):
        if email:
            addr = {'email': email}
            if name:
                addr['name'] = name
            result.append(addr)
    return result


class MailtrapProvider(EmailProvider):

    def __init__(self):
        self._token: Optional[str] = None

    def _get_token(self) -> str:
        if not self._token:
            self._token = getattr(settings, 'EMAIL_MAILTRAP_API_TOKEN', None)
            if not self._token:
                raise EmailConfigurationError(
                    "EMAIL_MAILTRAP_API_TOKEN is not set. Add it to your .env file."
                )
        return self._token

    def _get_url(self) -> str:
        if getattr(settings, 'EMAIL_MAILTRAP_SANDBOX', False):
            inbox_id = getattr(settings, 'EMAIL_MAILTRAP_INBOX_ID', '')
            if not inbox_id:
                raise EmailConfigurationError(
                    "EMAIL_MAILTRAP_SANDBOX is enabled but EMAIL_MAILTRAP_INBOX_ID is not set."
                )
            return _MAILTRAP_SANDBOX_URL.format(inbox_id=inbox_id)
        return _MAILTRAP_SEND_URL

    def _headers(self) -> dict:
        return {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self._get_token()}',
        }

    def _build_payload(self, message: EmailMessage) -> dict:
        from_addr = _address(message.from_email or settings.DEFAULT_FROM_EMAIL)
        if not from_addr:
            raise EmailConfigurationError(
                "No valid sender address. Set DEFAULT_FROM_EMAIL or message.from_email."
            )
        reply_to = _address(
            message.reply_to or getattr(settings, 'DEFAULT_REPLY_TO_EMAIL', None)
        )

        payload: dict = {
            'from': from_addr,
            'to': _address_list(message.to),
            'subject': message.subject,
            'html': message.html_body,
        }

        if message.text_body:
            payload['text'] = message.text_body
        if reply_to:
            payload['reply_to'] = reply_to
        if message.cc:
            payload['cc'] = _address_list(message.cc)
        if message.bcc:
            payload['bcc'] = _address_list(message.bcc)
        if message.tags:
            # Mailtrap accepts a single category per message.
            payload['category'] = message.tags[0]
        if message.metadata:
            payload['custom_variables'] = {
                str(k): str(v) for k, v in message.metadata.items()
            }

        if message.attachments:
            payload['attachments'] = [
                {
                    'filename': att.filename,
                    'content': base64.b64encode(att.content).decode(),
                    'type': att.content_type,
                    'disposition': 'inline' if att.inline else 'attachment',
                    **(
                        {'content_id': att.content_id or att.filename}
                        if att.inline else {}
                    ),
                }
                for att in message.attachments
            ]

        return payload

    def send(self, message: EmailMessage) -> str:
        payload = self._build_payload(message)

        try:
            resp = requests.post(
                self._get_url(),
                json=payload,
                headers=self._headers(),
                timeout=15,
            )
        except requests.RequestException as exc:
            raise EmailProviderError(f"Mailtrap network error: {exc}") from exc

        return self._handle_response(resp)

    def validate_configuration(self) -> None:
        if not getattr(settings, 'EMAIL_MAILTRAP_API_TOKEN', None):
            raise EmailConfigurationError("EMAIL_MAILTRAP_API_TOKEN is not configured.")
        if not getattr(settings, 'DEFAULT_FROM_EMAIL', None):
            raise EmailConfigurationError("DEFAULT_FROM_EMAIL is not configured.")
        if getattr(settings, 'EMAIL_MAILTRAP_SANDBOX', False) and not getattr(
            settings, 'EMAIL_MAILTRAP_INBOX_ID', ''
        ):
            raise EmailConfigurationError(
                "EMAIL_MAILTRAP_SANDBOX is enabled but EMAIL_MAILTRAP_INBOX_ID is not configured."
            )

    # ── internal helpers ──────────────────────────────────────────────────────

    def _handle_response(self, resp: requests.Response) -> str:
        try:
            data = resp.json()
        except ValueError as exc:
            raise EmailProviderError(
                f"Mailtrap returned invalid JSON ({resp.status_code}): {resp.text}"
            ) from exc

        if resp.status_code in (200, 201) and data.get('success'):
            message_ids = data.get('message_ids') or []
            return message_ids[0] if message_ids else ''

        self._raise_from_response(resp.status_code, data)

    def _raise_from_response(self, status_code: int, data: dict) -> None:
        errors = data.get('errors') or data.get('error') or data.get('message')
        detail = '; '.join(errors) if isinstance(errors, list) else str(errors)

        if status_code in (401, 403):
            raise EmailConfigurationError(f"Mailtrap auth failed: {detail}")
        if status_code in (400, 422):
            raise EmailDeliveryError(f"Mailtrap rejected the message: {detail}")
        if status_code == 429:
            raise EmailProviderError(f"Mailtrap rate limit exceeded: {detail}")
        raise EmailProviderError(f"Mailtrap error {status_code}: {detail}")
