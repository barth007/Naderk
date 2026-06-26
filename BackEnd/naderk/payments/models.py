import uuid
from django.db import models
from django.conf import settings


class PaymentTransaction(models.Model):
    class Provider(models.TextChoices):
        PAYSTACK    = 'PAYSTACK',    'Paystack'
        FLUTTERWAVE = 'FLUTTERWAVE', 'Flutterwave'

    class Status(models.TextChoices):
        INITIATED = 'INITIATED', 'Initiated'
        SUCCESS   = 'SUCCESS',   'Success'
        FAILED    = 'FAILED',    'Failed'
        ABANDONED = 'ABANDONED', 'Abandoned'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user            = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='payment_transactions')
    provider        = models.CharField(max_length=20, choices=Provider.choices)
    reference       = models.CharField(max_length=255, unique=True, db_index=True)
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
