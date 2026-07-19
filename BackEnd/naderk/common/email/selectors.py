"""Read-only helpers for querying EmailLog / EmailEvent."""

from django.utils import timezone
from .models import EmailLog, EmailEvent
from .constants import EmailStatus


def get_email_log(log_id: str) -> EmailLog:
    return EmailLog.objects.get(pk=log_id)


def get_log_by_provider_id(provider_message_id: str) -> EmailLog | None:
    return EmailLog.objects.filter(provider_message_id=provider_message_id).first()


def get_emails_for_recipient(email: str, limit: int = 50):
    return EmailLog.objects.filter(recipient=email).order_by('-created_at')[:limit]


def get_failed_emails(since=None):
    qs = EmailLog.objects.filter(
        status__in=[EmailStatus.FAILED, EmailStatus.BOUNCED, EmailStatus.COMPLAINED]
    )
    if since:
        qs = qs.filter(created_at__gte=since)
    return qs.order_by('-created_at')


def get_events_for_log(log_id: str):
    return EmailEvent.objects.filter(email_log_id=log_id).order_by('timestamp')


def daily_send_count(recipient: str) -> int:
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    return EmailLog.objects.filter(recipient=recipient, created_at__gte=today_start).count()
