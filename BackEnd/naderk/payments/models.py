import uuid
from django.db import models
from django.conf import settings


class PaymentProviderChoices(models.TextChoices):
    PAYSTACK    = 'PAYSTACK',    'Paystack'
    MONNIFY     = 'MONNIFY',     'Monnify'
    FLUTTERWAVE = 'FLUTTERWAVE', 'Flutterwave'


class PaymentTransaction(models.Model):
    # Kept as a nested alias for backwards compatibility with existing references.
    Provider = PaymentProviderChoices

    class Status(models.TextChoices):
        INITIATED = 'INITIATED', 'Initiated'
        SUCCESS   = 'SUCCESS',   'Success'
        FAILED    = 'FAILED',    'Failed'
        ABANDONED = 'ABANDONED', 'Abandoned'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payment_transactions')
    provider        = models.CharField(max_length=20, choices=Provider.choices)
    reference       = models.CharField(max_length=255, unique=True, db_index=True)
    # Provider-generated reference (e.g. Monnify transactionReference "MNFY|..."),
    # distinct from our own `reference` which we send as the provider's paymentReference.
    provider_txn_ref = models.CharField(max_length=255, blank=True, default='', db_index=True)
    idempotency_key = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    amount_kobo  = models.PositiveIntegerField()
    currency     = models.CharField(max_length=10, default='NGN')
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.INITIATED)
    order        = models.ForeignKey(
        'ecommerce.Order', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='payment_transactions'
    )
    appointment  = models.ForeignKey(
        'appointments.Appointment', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='payment_transactions'
    )
    raw_response = models.JSONField(default=dict)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.provider} {self.reference} [{self.status}]"


class PaymentGateway(models.Model):
    """
    Runtime, admin-managed configuration for a payment provider. Replaces the
    env-only Paystack config (which remains a fallback). Secret keys are stored
    encrypted and never serialized back out.
    """
    class Mode(models.TextChoices):
        TEST = 'TEST', 'Test'
        LIVE = 'LIVE', 'Live'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    provider      = models.CharField(max_length=20, choices=PaymentProviderChoices.choices)
    mode          = models.CharField(max_length=10, choices=Mode.choices, default=Mode.TEST)
    display_name  = models.CharField(max_length=100)
    is_active     = models.BooleanField(default=False)
    is_default    = models.BooleanField(default=False)
    # Client-safe key exposed to the SDK: Paystack public key / Monnify API key.
    client_key    = models.CharField(max_length=255, blank=True, default='')
    # Fernet ciphertext — access via get_secret_key()/set_secret_key().
    secret_key_encrypted = models.TextField(blank=True, default='')
    # Monnify contract code (first-class; other providers leave blank).
    contract_code = models.CharField(max_length=100, blank=True, default='')
    # Optional provider-specific extras (e.g. webhook_secret, payment_methods).
    config        = models.JSONField(default=dict, blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['provider', 'mode'], name='unique_gateway_provider_mode'),
        ]
        ordering = ['provider', 'mode']

    def set_secret_key(self, raw: str) -> None:
        from .crypto import encrypt_secret
        self.secret_key_encrypted = encrypt_secret(raw or '')

    def get_secret_key(self) -> str:
        from .crypto import decrypt_secret
        return decrypt_secret(self.secret_key_encrypted)

    @property
    def has_secret_key(self) -> bool:
        return bool(self.secret_key_encrypted)

    def __str__(self):
        return f"{self.display_name} ({self.provider}/{self.mode})"
