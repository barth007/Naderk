"""Tests for the Mailtrap email provider and provider selection."""

from unittest import mock

from django.test import SimpleTestCase, override_settings

from .providers.base import Attachment, EmailMessage
from .providers.mailtrap import MailtrapProvider
from .exceptions import EmailConfigurationError, EmailDeliveryError, EmailProviderError
from ._provider_registry import get_provider, _instances


def _make_message(**overrides):
    defaults = dict(
        to=['Jane Doe <jane@example.com>'],
        subject='Welcome',
        html_body='<p>Hi</p>',
        text_body='Hi',
    )
    defaults.update(overrides)
    return EmailMessage(**defaults)


def _fake_response(status_code=200, json_data=None):
    resp = mock.Mock()
    resp.status_code = status_code
    resp.json.return_value = json_data if json_data is not None else {}
    resp.text = str(json_data)
    return resp


@override_settings(
    EMAIL_MAILTRAP_API_TOKEN='tok_123',
    DEFAULT_FROM_EMAIL='NaderkEye Care <notification@naderela.com>',
    EMAIL_MAILTRAP_SANDBOX=False,
)
class MailtrapProviderTests(SimpleTestCase):

    def test_missing_token_raises_configuration_error(self):
        with override_settings(EMAIL_MAILTRAP_API_TOKEN=''):
            with self.assertRaises(EmailConfigurationError):
                MailtrapProvider().send(_make_message())

    def test_payload_shape(self):
        provider = MailtrapProvider()
        payload = provider._build_payload(
            _make_message(
                cc=['cc@example.com'],
                tags=['welcome'],
                metadata={'user_id': 42},
                attachments=[Attachment(
                    filename='a.pdf', content=b'PDF', content_type='application/pdf',
                )],
            )
        )
        self.assertEqual(payload['from'], {'email': 'notification@naderela.com', 'name': 'NaderkEye Care'})
        self.assertEqual(payload['to'], [{'email': 'jane@example.com', 'name': 'Jane Doe'}])
        self.assertEqual(payload['cc'], [{'email': 'cc@example.com'}])
        self.assertEqual(payload['subject'], 'Welcome')
        self.assertEqual(payload['category'], 'welcome')
        self.assertEqual(payload['custom_variables'], {'user_id': '42'})
        self.assertEqual(payload['attachments'][0]['filename'], 'a.pdf')
        self.assertEqual(payload['attachments'][0]['disposition'], 'attachment')

    def test_send_success_returns_message_id(self):
        provider = MailtrapProvider()
        fake = _fake_response(200, {'success': True, 'message_ids': ['mid_1']})
        with mock.patch('naderk.common.email.providers.mailtrap.requests.post', return_value=fake) as post:
            result = provider.send(_make_message())
        self.assertEqual(result, 'mid_1')
        args, kwargs = post.call_args
        self.assertEqual(args[0], 'https://send.api.mailtrap.io/api/send')
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer tok_123')

    def test_auth_failure_raises_configuration_error(self):
        provider = MailtrapProvider()
        fake = _fake_response(401, {'success': False, 'errors': ['Unauthorized']})
        with mock.patch('naderk.common.email.providers.mailtrap.requests.post', return_value=fake):
            with self.assertRaises(EmailConfigurationError):
                provider.send(_make_message())

    def test_validation_error_raises_delivery_error(self):
        provider = MailtrapProvider()
        fake = _fake_response(422, {'success': False, 'errors': ["'from' is invalid"]})
        with mock.patch('naderk.common.email.providers.mailtrap.requests.post', return_value=fake):
            with self.assertRaises(EmailDeliveryError):
                provider.send(_make_message())

    def test_network_error_raises_provider_error(self):
        import requests
        provider = MailtrapProvider()
        with mock.patch(
            'naderk.common.email.providers.mailtrap.requests.post',
            side_effect=requests.RequestException('boom'),
        ):
            with self.assertRaises(EmailProviderError):
                provider.send(_make_message())

    def test_sandbox_url_requires_inbox_id(self):
        with override_settings(EMAIL_MAILTRAP_SANDBOX=True, EMAIL_MAILTRAP_INBOX_ID=''):
            with self.assertRaises(EmailConfigurationError):
                MailtrapProvider()._get_url()

    def test_sandbox_url_uses_inbox(self):
        with override_settings(EMAIL_MAILTRAP_SANDBOX=True, EMAIL_MAILTRAP_INBOX_ID='99'):
            self.assertEqual(
                MailtrapProvider()._get_url(),
                'https://sandbox.api.mailtrap.io/api/send/99',
            )


class ProviderRegistryTests(SimpleTestCase):

    def setUp(self):
        _instances.clear()
        self.addCleanup(_instances.clear)

    @override_settings(EMAIL_MAILTRAP_API_TOKEN='tok_123')
    def test_registry_returns_mailtrap_provider(self):
        self.assertIsInstance(get_provider('mailtrap'), MailtrapProvider)

    def test_unknown_provider_raises(self):
        with self.assertRaises(EmailConfigurationError):
            get_provider('does-not-exist')
