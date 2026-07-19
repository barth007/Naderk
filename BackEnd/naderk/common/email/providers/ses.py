from django.conf import settings

from .base import EmailProvider, EmailMessage
from ..exceptions import EmailDeliveryError, EmailProviderError, EmailConfigurationError


class SESProvider(EmailProvider):
    """
    Sends email via AWS Simple Email Service (SES) using boto3.
    Requires:
        AWS_SES_ACCESS_KEY_ID
        AWS_SES_SECRET_ACCESS_KEY
        AWS_SES_REGION  (e.g. 'eu-west-1')
    Optional:
        AWS_SES_CONFIGURATION_SET  — for open/click tracking
    """

    def __init__(self):
        self.access_key = getattr(settings, 'AWS_SES_ACCESS_KEY_ID', None)
        self.secret_key = getattr(settings, 'AWS_SES_SECRET_ACCESS_KEY', None)
        self.region = getattr(settings, 'AWS_SES_REGION', 'us-east-1')
        self.configuration_set = getattr(settings, 'AWS_SES_CONFIGURATION_SET', None)

        if not self.access_key or not self.secret_key:
            raise EmailConfigurationError(
                "AWS_SES_ACCESS_KEY_ID and AWS_SES_SECRET_ACCESS_KEY must be set."
            )

    def _client(self):
        try:
            import boto3
        except ImportError as exc:
            raise EmailConfigurationError(
                "boto3 is not installed. Run: pip install boto3"
            ) from exc

        return boto3.client(
            'ses',
            region_name=self.region,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
        )

    def send(self, message: EmailMessage) -> None:
        from_email = message.from_email or settings.DEFAULT_FROM_EMAIL
        client = self._client()

        body = {'Html': {'Data': message.html_body, 'Charset': 'UTF-8'}}
        if message.text_body:
            body['Text'] = {'Data': message.text_body, 'Charset': 'UTF-8'}

        destination = {'ToAddresses': message.to}
        if message.cc:
            destination['CcAddresses'] = message.cc
        if message.bcc:
            destination['BccAddresses'] = message.bcc

        kwargs = {
            'Source': from_email,
            'Destination': destination,
            'Message': {
                'Subject': {'Data': message.subject, 'Charset': 'UTF-8'},
                'Body': body,
            },
        }

        if message.reply_to:
            kwargs['ReplyToAddresses'] = [message.reply_to]

        if self.configuration_set:
            kwargs['ConfigurationSetName'] = self.configuration_set

        try:
            client.send_email(**kwargs)
        except client.exceptions.MessageRejected as exc:
            raise EmailDeliveryError(f"SES rejected the message: {exc}") from exc
        except Exception as exc:
            raise EmailProviderError(f"SES error: {exc}") from exc
