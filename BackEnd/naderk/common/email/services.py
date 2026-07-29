"""
EmailService — the single interface all application modules use to send email.

Every public method:
  1. Creates an EmailLog row (status=QUEUED)
  2. Renders the appropriate Django HTML template
  3. Dispatches send_email_task to Celery (non-blocking)

Provider is selected by EMAIL_PROVIDER in settings / .env:
  postmark  → PostmarkProvider  (production default)
  smtp      → SMTPProvider      (dev / self-hosted fallback)
  resend    → ResendProvider
  ses       → SESProvider

Usage:
    from naderk.common.email.services import email_service
    email_service.send_otp(user=user, code=code)
"""

import dataclasses
import logging
from typing import List, Optional, Dict, Any

from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone

from .providers.base import EmailMessage, Attachment
from .exceptions import EmailError, EmailConfigurationError
from ._provider_registry import get_provider

logger = logging.getLogger(__name__)


def _brand() -> str:
    return getattr(settings, 'BRAND_NAME', 'Naderkela')


def _frontend_url(path: str = '') -> str:
    base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    return f"{base}{path}"


def _base_context() -> dict:
    return {
        'brand_name': _brand(),
        'brand_logo_url': getattr(settings, 'BRAND_LOGO_URL', ''),
    }


class EmailService:
    """
    High-level email service. Each method maps to one transactional email type.
    All sends are dispatched asynchronously via Celery.
    """

    def _get_provider_name(self) -> str:
        return getattr(settings, 'EMAIL_PROVIDER', 'smtp').lower()

    def _create_log(self, recipient: str, subject: str, template_name: str,
                    tags: list, metadata: dict, sent_by=None):
        from .models import EmailLog
        from .constants import EmailStatus
        return EmailLog.objects.create(
            recipient=recipient,
            subject=subject,
            template_name=template_name,
            provider=self._get_provider_name(),
            status=EmailStatus.QUEUED,
            tags=tags,
            metadata=metadata,
            sent_by=sent_by,
        )

    def _dispatch(self, log, message: EmailMessage) -> None:
        """Serialise the message and enqueue the Celery task."""
        from .tasks import send_email_task

        payload = dataclasses.asdict(message)
        # Attachment bytes are not JSON-serialisable — encode to list[int]
        for att in payload.get('attachments', []):
            if isinstance(att.get('content'), (bytes, bytearray)):
                att['content'] = list(att['content'])

        send_email_task.delay(
            log_id=str(log.id),
            provider_name=self._get_provider_name(),
            message_payload=payload,
        )

    def _render(self, template: str, context: dict) -> tuple[str, str]:
        """Returns (html_body, text_body)."""
        from .utils import strip_html
        html = render_to_string(template, {**_base_context(), **context})
        text = strip_html(html)
        return html, text

    # ── Authentication ────────────────────────────────────────────────────────

    def send_otp(self, *, user, code: str, expires_minutes: int = 5) -> None:
        subject = f"Your {_brand()} Verification Code"
        template = 'email/authentication/otp.html'
        ctx = {'code': code, 'expires_minutes': expires_minutes}
        html, text = self._render(template, ctx)

        log = self._create_log(user.email, subject, template,
                               tags=['otp', 'auth'],
                               metadata={'user_id': str(user.id)})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['otp'], metadata={'log_id': str(log.id)},
        ))

    def send_welcome(self, *, user) -> None:
        subject = f"Welcome to {_brand()}!"
        template = 'email/authentication/welcome.html'
        ctx = {
            'first_name': user.first_name or user.email.split('@')[0],
            'login_url': _frontend_url('/login'),
            'features': [
                {'icon': '📅', 'title': 'Book appointments',
                 'description': 'Schedule consultations with specialists.'},
                {'icon': '📋', 'title': 'View medical records',
                 'description': 'Access your complete health history.'},
                {'icon': '💊', 'title': 'Manage prescriptions',
                 'description': 'Track and refill your medications easily.'},
            ],
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['welcome'],
                               metadata={'user_id': str(user.id)})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['welcome'],
        ))

    def send_email_verification(self, *, user, verification_url: str,
                                expires_minutes: int = 1440) -> None:
        subject = f"Verify your {_brand()} email"
        template = 'email/authentication/email_verification.html'
        ctx = {
            'email': user.email,
            'verification_url': verification_url,
            'expires_minutes': expires_minutes,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['verification'],
                               metadata={'user_id': str(user.id)})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['verification'],
        ))

    def send_password_reset(self, *, user, reset_url: str,
                            expires_minutes: int = 30) -> None:
        subject = f"Reset your {_brand()} password"
        template = 'email/authentication/password_reset.html'
        ctx = {
            'email': user.email,
            'reset_url': reset_url,
            'expires_minutes': expires_minutes,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['password-reset'],
                               metadata={'user_id': str(user.id)})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['password-reset'],
        ))

    # ── Appointments ──────────────────────────────────────────────────────────

    def send_appointment_confirmation(self, *, user, doctor_name: str,
                                      date: str, time: str,
                                      appointment_type: str,
                                      location: str = '',
                                      reference: str = '',
                                      reschedule_url: str = '') -> None:
        subject = f"Appointment Confirmed — {date} at {time}"
        template = 'email/appointments/confirmation.html'
        patient_name = f"{user.first_name} {user.last_name}".strip() or user.email
        ctx = {
            'patient_name': patient_name,
            'doctor_name': doctor_name,
            'date': date, 'time': time,
            'appointment_type': appointment_type,
            'location': location, 'reference': reference,
            'reschedule_url': reschedule_url,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['appointment', 'confirmation'],
                               metadata={'reference': reference})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['appointment'],
        ))

    def send_appointment_reminder(self, *, user, doctor_name: str,
                                  date: str, time: str,
                                  time_until: str,
                                  appointment_type: str,
                                  manage_url: str = '') -> None:
        subject = f"Appointment Reminder — {date} at {time}"
        template = 'email/appointments/reminder.html'
        patient_name = f"{user.first_name} {user.last_name}".strip() or user.email
        ctx = {
            'patient_name': patient_name,
            'doctor_name': doctor_name,
            'date': date, 'time': time,
            'time_until': time_until,
            'appointment_type': appointment_type,
            'manage_url': manage_url,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['appointment', 'reminder'], metadata={})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['appointment', 'reminder'],
        ))

    def send_appointment_cancellation(self, *, user, doctor_name: str,
                                      date: str, time: str,
                                      reason: str = '',
                                      reschedule_url: str = '') -> None:
        subject = f"Appointment Cancelled — {date}"
        template = 'email/appointments/cancellation.html'
        patient_name = f"{user.first_name} {user.last_name}".strip() or user.email
        ctx = {
            'patient_name': patient_name,
            'doctor_name': doctor_name,
            'date': date, 'time': time,
            'reason': reason,
            'reschedule_url': reschedule_url,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['appointment', 'cancellation'], metadata={})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
        ))

    # ── Marketplace ───────────────────────────────────────────────────────────

    def send_order_confirmation(self, *, user, reference: str,
                                items: list, total: str,
                                order_url: str = '') -> None:
        subject = f"Order Confirmed — #{reference}"
        template = 'email/marketplace/order_confirmation.html'
        customer_name = f"{user.first_name} {user.last_name}".strip() or user.email
        ctx = {
            'customer_name': customer_name,
            'reference': reference,
            'items': items, 'total': total,
            'order_url': order_url,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['order', 'marketplace'],
                               metadata={'reference': reference})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['order'],
        ))

    def send_payment_receipt(self, *, user, reference: str,
                             description: str, amount: str,
                             payment_date: str,
                             payment_method: str = '') -> None:
        subject = f"Payment Receipt — {reference}"
        template = 'email/marketplace/payment_receipt.html'
        customer_name = f"{user.first_name} {user.last_name}".strip() or user.email
        ctx = {
            'customer_name': customer_name,
            'reference': reference, 'description': description,
            'amount': amount, 'payment_date': payment_date,
            'payment_method': payment_method,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['payment', 'receipt'],
                               metadata={'reference': reference})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
            tags=['payment'],
        ))

    # ── Prescriptions ─────────────────────────────────────────────────────────

    def send_prescription_ready(self, *, user, doctor_name: str,
                                notes: str = '',
                                prescription_url: str = '') -> None:
        subject = f"Your prescription from {doctor_name} is ready"
        template = 'email/prescriptions/ready.html'
        patient_name = f"{user.first_name} {user.last_name}".strip() or user.email
        ctx = {
            'patient_name': patient_name,
            'doctor_name': doctor_name,
            'notes': notes,
            'prescription_url': prescription_url,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(user.email, subject, template,
                               tags=['prescription'], metadata={})
        self._dispatch(log, EmailMessage(
            to=[user.email], subject=subject, html_body=html, text_body=text,
        ))

    # ── Generic / notification ────────────────────────────────────────────────

    def send_notification(self, *, recipient_email: str, title: str,
                          message: str, action_url: str = '',
                          action_label: str = '',
                          tags: Optional[List[str]] = None,
                          metadata: Optional[Dict[str, Any]] = None) -> None:
        template = 'email/notifications/general.html'
        ctx = {
            'title': title, 'message': message,
            'action_url': action_url, 'action_label': action_label,
        }
        html, text = self._render(template, ctx)
        log = self._create_log(recipient_email, title, template,
                               tags=tags or ['notification'],
                               metadata=metadata or {})
        self._dispatch(log, EmailMessage(
            to=[recipient_email], subject=title, html_body=html, text_body=text,
            tags=tags or [],
        ))

    def send_raw(self, *, to: List[str], subject: str,
                 html_body: str, text_body: str = '',
                 from_email: Optional[str] = None,
                 reply_to: Optional[str] = None,
                 tags: Optional[List[str]] = None,
                 attachments: Optional[List[Attachment]] = None) -> None:
        """Escape hatch for fully custom one-off emails."""
        from .utils import strip_html
        log = self._create_log(
            recipient=', '.join(to),
            subject=subject,
            template_name='',
            tags=tags or [],
            metadata={},
        )
        self._dispatch(log, EmailMessage(
            to=to, subject=subject,
            html_body=html_body,
            text_body=text_body or strip_html(html_body),
            from_email=from_email, reply_to=reply_to,
            tags=tags or [],
            attachments=attachments or [],
        ))

    def send_now(self, *, to: List[str], subject: str,
                 html_body: str, text_body: str = '') -> str:
        """Bypass Celery — send synchronously. Returns provider message ID."""
        from .utils import strip_html
        provider = get_provider()
        return provider.send(EmailMessage(
            to=to, subject=subject,
            html_body=html_body,
            text_body=text_body or strip_html(html_body),
        ))


# Module-level singleton — import this everywhere
email_service = EmailService()
