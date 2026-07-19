from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.core.mail import BadHeaderError
from smtplib import SMTPException

from .base import EmailProvider, EmailMessage
from ..exceptions import EmailDeliveryError, EmailProviderError


class SMTPProvider(EmailProvider):
    """
    Sends email via Django's built-in SMTP backend.
    Reads EMAIL_HOST, EMAIL_PORT, EMAIL_HOST_USER, etc. from Django settings.
    """

    def send(self, message: EmailMessage) -> str:
        from_email = message.from_email or settings.DEFAULT_FROM_EMAIL

        # Inject Postmark message-stream header when using Postmark's SMTP gateway
        extra_headers = {}
        stream = getattr(settings, 'POSTMARK_MESSAGE_STREAM', '')
        if stream and 'postmarkapp.com' in getattr(settings, 'EMAIL_HOST', ''):
            extra_headers['X-PM-Message-Stream'] = stream

        mail = EmailMultiAlternatives(
            subject=message.subject,
            body=message.text_body or _strip_html(message.html_body),
            from_email=from_email,
            to=message.to,
            cc=message.cc,
            bcc=message.bcc,
            reply_to=[message.reply_to] if message.reply_to else None,
            headers=extra_headers,
        )

        if message.html_body:
            mail.attach_alternative(message.html_body, 'text/html')

        try:
            mail.send(fail_silently=False)
        except BadHeaderError as exc:
            raise EmailDeliveryError(f"Invalid email header: {exc}") from exc
        except SMTPException as exc:
            raise EmailProviderError(f"SMTP error: {exc}") from exc
        except OSError as exc:
            raise EmailProviderError(f"Network error sending email: {exc}") from exc

        return ''  # SMTP does not return a provider message ID


def _strip_html(html: str) -> str:
    """Very simple HTML → plain text fallback."""
    import re
    return re.sub(r'<[^>]+>', '', html).strip()
