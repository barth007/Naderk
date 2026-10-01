"""
Send a one-off test email through the currently configured provider.

    python manage.py send_test_email you@example.com
    python manage.py send_test_email you@example.com --provider mailtrap

Verifies live provider credentials and domain setup end-to-end. Sends
synchronously (no Celery) and prints the provider message id on success.
"""

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from naderk.common.email._provider_registry import get_provider
from naderk.common.email.exceptions import EmailError
from naderk.common.email.providers.base import EmailMessage


class Command(BaseCommand):
    help = 'Send a test email through the configured email provider.'

    def add_arguments(self, parser):
        parser.add_argument('recipient', help='Destination email address.')
        parser.add_argument(
            '--provider',
            default=None,
            help='Override EMAIL_PROVIDER for this send (e.g. mailtrap).',
        )
        parser.add_argument(
            '--subject',
            default='NaderkEye Care — test email',
            help='Custom subject line.',
        )

    def handle(self, *args, **options):
        recipient = options['recipient']
        provider_name = options['provider'] or getattr(settings, 'EMAIL_PROVIDER', 'smtp')
        subject = options['subject']

        self.stdout.write(f'Provider : {provider_name}')
        self.stdout.write(f'From     : {getattr(settings, "DEFAULT_FROM_EMAIL", "(unset)")}')
        self.stdout.write(f'To       : {recipient}')

        message = EmailMessage(
            to=[recipient],
            subject=subject,
            html_body=(
                '<div style="font-family:sans-serif">'
                '<h2>It works ✅</h2>'
                '<p>This is a test email from NaderkEye Care confirming that the '
                f'<strong>{provider_name}</strong> email provider is configured correctly.</p>'
                '</div>'
            ),
            text_body=(
                'It works. This test email confirms the '
                f'{provider_name} provider is configured correctly.'
            ),
            tags=['test'],
        )

        try:
            provider = get_provider(provider_name)
            message_id = provider.send(message)
        except EmailError as exc:
            raise CommandError(f'Send failed: {exc}') from exc

        self.stdout.write(self.style.SUCCESS(
            f'Sent. Provider message id: {message_id or "(none returned)"}'
        ))
