from django.test import SimpleTestCase, override_settings
from naderk.common.email.providers.mailtrap import MailtrapProvider
from naderk.common.email.exceptions import EmailConfigurationError
from naderk.common.email._provider_registry import get_provider, _instances


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
