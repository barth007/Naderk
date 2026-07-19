class EmailError(Exception):
    """Base class for all email errors."""

class EmailDeliveryError(EmailError):
    """Provider accepted the request but delivery failed or was rejected."""

class EmailProviderError(EmailError):
    """Provider returned an unexpected error (network, auth, rate-limit, etc.)."""

class EmailConfigurationError(EmailError):
    """The email service is misconfigured (missing API key, unknown provider, etc.)."""
