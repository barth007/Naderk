"""
Postmark email provider.

Required settings / env vars:
    POSTMARK_SERVER_TOKEN   – server API token from postmarkapp.com
    POSTMARK_MESSAGE_STREAM – message stream ID (default: 'outbound')
    DEFAULT_FROM_EMAIL      – sender address (must be verified in Postmark)
    DEFAULT_REPLY_TO_EMAIL  – optional reply-to override
"""

import base64
import logging
from typing import List, Optional

import requests
from django.conf import settings

from .base import EmailMessage, EmailProvider
from ..exceptions import EmailConfigurationError, EmailDeliveryError, EmailProviderError

logger = logging.getLogger(__name__)

_POSTMARK_EMAIL_URL = 'https://api.postmarkapp.com/email'
_POSTMARK_BATCH_URL = 'https://api.postmarkapp.com/email/batch'
_POSTMARK_MESSAGE_URL = 'https://api.postmarkapp.com/messages/outbound/{id}'

# Postmark bounce type codes that represent hard bounces
_HARD_BOUNCE_TYPES = {
    'HardBounce', 'BadEmailAddress', 'InvalidDomain',
    'AddressChange', 'DNSError', 'SpamNotification',
}


class PostmarkProvider(EmailProvider):

    def __init__(self):
        self._token: Optional[str] = None
        self._stream: Optional[str] = None

    def _get_token(self) -> str:
        if not self._token:
            self._token = getattr(settings, 'POSTMARK_SERVER_TOKEN', None)
            if not self._token:
                raise EmailConfigurationError(
                    "POSTMARK_SERVER_TOKEN is not set. "
                    "Add it to your .env file and settings."
                )
        return self._token

    def _get_stream(self) -> str:
        if not self._stream:
            self._stream = getattr(settings, 'POSTMARK_MESSAGE_STREAM', 'outbound')
        return self._stream

    def _headers(self) -> dict:
        return {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Postmark-Server-Token': self._get_token(),
        }

    def _build_payload(self, message: EmailMessage) -> dict:
        from_email = message.from_email or settings.DEFAULT_FROM_EMAIL
        reply_to = (
            message.reply_to
            or getattr(settings, 'DEFAULT_REPLY_TO_EMAIL', None)
        )

        payload: dict = {
            'From': from_email,
            'To': ', '.join(message.to),
            'Subject': message.subject,
            'HtmlBody': message.html_body,
            'MessageStream': message.message_stream or self._get_stream(),
            'TrackOpens': message.track_opens,
            'TrackLinks': 'Html' if message.track_links else 'None',
        }

        if message.text_body:
            payload['TextBody'] = message.text_body
        if reply_to:
            payload['ReplyTo'] = reply_to
        if message.cc:
            payload['Cc'] = ', '.join(message.cc)
        if message.bcc:
            payload['Bcc'] = ', '.join(message.bcc)
        if message.tags:
            payload['Tag'] = message.tags[0]  # Postmark supports one tag per message
        if message.metadata:
            payload['Metadata'] = {str(k): str(v) for k, v in message.metadata.items()}

        if message.attachments:
            payload['Attachments'] = [
                {
                    'Name': att.filename,
                    'Content': base64.b64encode(att.content).decode(),
                    'ContentType': att.content_type,
                    **(
                        {'ContentID': att.content_id or f'cid:{att.filename}'}
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
                _POSTMARK_EMAIL_URL,
                json=payload,
                headers=self._headers(),
                timeout=15,
            )
        except requests.RequestException as exc:
            raise EmailProviderError(f"Postmark network error: {exc}") from exc

        return self._handle_response(resp)

    def send_bulk(self, messages: List[EmailMessage]) -> List[str]:
        if not messages:
            return []

        payloads = [self._build_payload(m) for m in messages]

        try:
            resp = requests.post(
                _POSTMARK_BATCH_URL,
                json=payloads,
                headers=self._headers(),
                timeout=30,
            )
        except requests.RequestException as exc:
            raise EmailProviderError(f"Postmark batch network error: {exc}") from exc

        try:
            data = resp.json()
        except ValueError as exc:
            raise EmailProviderError(f"Postmark returned invalid JSON: {resp.text}") from exc

        if not isinstance(data, list):
            self._raise_from_response(resp.status_code, data)

        ids = []
        for item in data:
            if item.get('ErrorCode', 0) != 0:
                logger.warning(
                    "Postmark batch item error %s: %s",
                    item.get('ErrorCode'),
                    item.get('Message'),
                )
                ids.append('')
            else:
                ids.append(item.get('MessageID', ''))
        return ids

    def get_delivery_status(self, provider_message_id: str) -> Optional[str]:
        url = _POSTMARK_MESSAGE_URL.format(id=provider_message_id)
        try:
            resp = requests.get(url, headers=self._headers(), timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return data.get('Status', '').lower()
        except Exception as exc:
            logger.warning("Could not fetch Postmark delivery status: %s", exc)
        return None

    def validate_configuration(self) -> None:
        token = getattr(settings, 'POSTMARK_SERVER_TOKEN', None)
        if not token:
            raise EmailConfigurationError("POSTMARK_SERVER_TOKEN is not configured.")
        if not getattr(settings, 'DEFAULT_FROM_EMAIL', None):
            raise EmailConfigurationError("DEFAULT_FROM_EMAIL is not configured.")

    # ── internal helpers ──────────────────────────────────────────────────────

    def _handle_response(self, resp: requests.Response) -> str:
        try:
            data = resp.json()
        except ValueError as exc:
            raise EmailProviderError(f"Postmark returned invalid JSON: {resp.text}") from exc

        if resp.status_code == 200 and data.get('ErrorCode', 0) == 0:
            return data.get('MessageID', '')

        self._raise_from_response(resp.status_code, data)

    def _raise_from_response(self, status_code: int, data: dict) -> None:
        error_code = data.get('ErrorCode', 0)
        message = data.get('Message', 'Unknown Postmark error')

        if status_code == 401 or error_code == 10:
            raise EmailConfigurationError(f"Postmark auth failed: {message}")
        if status_code == 422 or error_code in (300, 406, 407, 408, 409, 410):
            raise EmailDeliveryError(f"Postmark rejected message (code {error_code}): {message}")
        if status_code == 429:
            raise EmailProviderError(f"Postmark rate limit exceeded: {message}")
        raise EmailProviderError(f"Postmark error {status_code}/{error_code}: {message}")
