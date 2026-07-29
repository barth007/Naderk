"""
Celery tasks for async email delivery.

Every EmailService send method dispatches one of these tasks so HTTP
request threads are never blocked waiting for a provider API call.
"""

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# Max attempts: 1 original + 4 retries = 5 total
_MAX_RETRIES = 4
_RETRY_BACKOFF = 60  # seconds; doubles each retry (60 → 120 → 240 → 480)


@shared_task(bind=True, max_retries=_MAX_RETRIES, default_retry_delay=_RETRY_BACKOFF)
def send_email_task(self, log_id: str, provider_name: str, message_payload: dict):
    """
    Resolve the provider, send the message, and update the EmailLog row.
    Retries with exponential back-off on transient provider errors.
    Hard delivery failures (bad address, etc.) are NOT retried.
    """
    from .models import EmailLog
    from .constants import EmailStatus
    from .providers.base import EmailMessage, Attachment
    from .exceptions import EmailDeliveryError, EmailProviderError, EmailConfigurationError
    from ._provider_registry import get_provider

    try:
        log = EmailLog.objects.get(pk=log_id)
    except EmailLog.DoesNotExist:
        logger.error("send_email_task: EmailLog %s not found", log_id)
        return

    # Rebuild the EmailMessage from the serialised payload
    attachments = [
        Attachment(**a) for a in message_payload.pop('attachments', [])
    ]
    message = EmailMessage(**message_payload, attachments=attachments)

    try:
        provider = get_provider(provider_name)
        provider_message_id = provider.send(message)

        log.status = EmailStatus.SENT
        log.provider_message_id = provider_message_id or ''
        log.sent_at = timezone.now()
        log.save(update_fields=['status', 'provider_message_id', 'sent_at'])

    except EmailDeliveryError as exc:
        # Hard failure — do not retry
        logger.warning("Email delivery rejected (log=%s): %s", log_id, exc)
        log.status = EmailStatus.FAILED
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])

    except (EmailProviderError, EmailConfigurationError) as exc:
        # Possibly transient — retry with back-off
        logger.warning("Email provider error (log=%s, attempt=%d): %s",
                       log_id, self.request.retries + 1, exc)
        log.error_message = str(exc)
        log.save(update_fields=['error_message'])

        raise self.retry(
            exc=exc,
            countdown=_RETRY_BACKOFF * (2 ** self.request.retries),
        )

    except Exception as exc:
        logger.exception("Unexpected error in send_email_task (log=%s)", log_id)
        log.status = EmailStatus.FAILED
        log.error_message = str(exc)
        log.save(update_fields=['status', 'error_message'])


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def send_bulk_email_task(self, log_ids: list, provider_name: str, message_payloads: list):
    """Batch send — used when the service dispatches multiple messages at once."""
    from .models import EmailLog
    from .constants import EmailStatus
    from .providers.base import EmailMessage, Attachment
    from .exceptions import EmailProviderError, EmailConfigurationError
    from ._provider_registry import get_provider

    messages = []
    for payload in message_payloads:
        attachments = [Attachment(**a) for a in payload.pop('attachments', [])]
        messages.append(EmailMessage(**payload, attachments=attachments))

    try:
        provider = get_provider(provider_name)
        ids = provider.send_bulk(messages)
    except (EmailProviderError, EmailConfigurationError) as exc:
        logger.warning("Bulk email provider error: %s", exc)
        raise self.retry(exc=exc, countdown=120 * (2 ** self.request.retries))
    except Exception as exc:
        logger.exception("Unexpected error in send_bulk_email_task")
        EmailLog.objects.filter(pk__in=log_ids).update(
            status=EmailStatus.FAILED, error_message=str(exc)
        )
        return

    now = timezone.now()
    for log_id, provider_message_id in zip(log_ids, ids):
        EmailLog.objects.filter(pk=log_id).update(
            status=EmailStatus.SENT,
            provider_message_id=provider_message_id or '',
            sent_at=now,
        )
