import uuid
from django.db import models
from django.conf import settings
from .constants import EmailStatus, EmailEventType, BounceType


class EmailLog(models.Model):
    """Records every email the platform attempts to send."""

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient           = models.EmailField()
    subject             = models.CharField(max_length=500)
    template_name       = models.CharField(max_length=200, blank=True)
    provider            = models.CharField(max_length=50)
    provider_message_id = models.CharField(max_length=255, blank=True, db_index=True)
    status              = models.CharField(
        max_length=20, choices=EmailStatus.choices, default=EmailStatus.QUEUED, db_index=True
    )
    tags                = models.JSONField(default=list, blank=True)
    metadata            = models.JSONField(default=dict, blank=True)
    error_message       = models.TextField(blank=True)
    sent_by             = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='sent_emails',
    )
    created_at          = models.DateTimeField(auto_now_add=True, db_index=True)
    sent_at             = models.DateTimeField(null=True, blank=True)
    delivered_at        = models.DateTimeField(null=True, blank=True)
    opened_at           = models.DateTimeField(null=True, blank=True)
    clicked_at          = models.DateTimeField(null=True, blank=True)
    bounced_at          = models.DateTimeField(null=True, blank=True)
    complained_at       = models.DateTimeField(null=True, blank=True)
    bounce_type         = models.CharField(
        max_length=20, choices=BounceType.choices, blank=True
    )

    class Meta:
        app_label = 'common'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['recipient', 'created_at']),
            models.Index(fields=['status', 'created_at']),
        ]

    def __str__(self):
        return f"EmailLog({self.recipient}, {self.subject[:40]}, {self.status})"

    @property
    def is_delivered(self) -> bool:
        return self.status in (EmailStatus.DELIVERED, EmailStatus.OPENED, EmailStatus.CLICKED)

    @property
    def is_failed(self) -> bool:
        return self.status in (EmailStatus.BOUNCED, EmailStatus.FAILED, EmailStatus.COMPLAINED)


class EmailEvent(models.Model):
    """Append-only audit trail — one row per provider event (delivery, open, click, …)."""

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email_log  = models.ForeignKey(EmailLog, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=20, choices=EmailEventType.choices, db_index=True)
    provider   = models.CharField(max_length=50)
    payload    = models.JSONField(default=dict)
    timestamp  = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'common'
        ordering = ['timestamp']

    def __str__(self):
        return f"EmailEvent({self.event_type}, {self.email_log_id})"
