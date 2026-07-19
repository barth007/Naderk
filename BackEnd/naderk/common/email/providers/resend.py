from django.conf import settings

from .base import EmailProvider, EmailMessage
from ..exceptions import EmailDeliveryError, EmailProviderError, EmailConfigurationError


class ResendProvider(EmailProvider):
    """
    Sends email via the Resend API (https://resend.com).
    Requires:
        EMAIL_RESEND_API_KEY in settings / .env
    Optional:
        pip install resend
    """

    def __init__(self):
        self.api_key = getattr(settings, 'EMAIL_RESEND_API_KEY', None)
        if not self.api_key:
            raise EmailConfigurationError(
                "EMAIL_RESEND_API_KEY is not set. Add it to your .env file."
            )

    def send(self, message: EmailMessage) -> None:
        try:
            import resend
        except ImportError as exc:
            raise EmailConfigurationError(
                "The 'resend' package is not installed. Run: pip install resend"
            ) from exc

        resend.api_key = self.api_key
        from_email = message.from_email or settings.DEFAULT_FROM_EMAIL

        params = {
            "from": from_email,
            "to": message.to,
            "subject": message.subject,
            "html": message.html_body,
        }

        if message.text_body:
            params["text"] = message.text_body
        if message.cc:
            params["cc"] = message.cc
        if message.bcc:
            params["bcc"] = message.bcc
        if message.reply_to:
            params["reply_to"] = message.reply_to

        try:
            response = resend.Emails.send(params)
        except Exception as exc:
            raise EmailProviderError(f"Resend API error: {exc}") from exc

        # Resend returns {"id": "..."} on success; no id means failure
        if not response.get("id"):
            raise EmailDeliveryError(f"Resend rejected the message: {response}")
