"""
Extend Life Africa: gifts from the public and offers to volunteer.

ELA is a charity programme run from this site. A gift is paid through the same
payment gateways as orders and appointments (a PaymentTransaction points back
at the Donation), but the donor does not need an account.
"""
import uuid

from django.conf import settings
from django.db import models


class Donation(models.Model):
    class Currency(models.TextChoices):
        NGN = 'NGN', 'Naira'
        GBP = 'GBP', 'Pound sterling'
        USD = 'USD', 'US dollar'

    class Frequency(models.TextChoices):
        ONE_TIME = 'ONE_TIME', 'One-time'
        # Not a recurring charge: the donor is reminded a year later and
        # chooses whether to give again.
        ANNUAL = 'ANNUAL', 'Annually (yearly reminder)'

    class Purpose(models.TextChoices):
        TEST = 'TEST', 'Sponsor a test'
        INTERVENTION = 'INTERVENTION', 'Sponsor an intervention'
        GENERAL = 'GENERAL', 'General donation'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Awaiting payment'
        PAID = 'PAID', 'Paid'
        FAILED = 'FAILED', 'Failed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Set when the donor happened to be signed in; gifts do not require an account.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='donations',
    )
    donor_name = models.CharField(max_length=150)
    donor_email = models.EmailField()

    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.NGN)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.ONE_TIME)
    purpose = models.CharField(max_length=15, choices=Purpose.choices, default=Purpose.GENERAL)

    dedicated_to = models.CharField(max_length=150, blank=True)
    message = models.TextField(blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    payment_reference = models.CharField(max_length=255, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    # Annual gifts only: when to send the "time to give again" email, and when
    # it went. Cleared once the donor gives again.
    next_reminder_on = models.DateField(null=True, blank=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['frequency', 'next_reminder_on']),
            models.Index(fields=['donor_email']),
        ]

    def __str__(self):
        return f"{self.donor_name} — {self.currency} {self.amount} ({self.get_status_display()})"

    @property
    def amount_minor(self) -> int:
        """Amount in the currency's minor unit (kobo, pence, cents)."""
        from decimal import Decimal
        return int((self.amount * Decimal('100')).to_integral_value())


class VolunteerApplication(models.Model):
    class Role(models.TextChoices):
        GP = 'GP', 'GP'
        NURSE = 'NURSE', 'Nurse'
        NUTRITIONIST = 'NUTRITIONIST', 'Nutritionist'

    class SessionFormat(models.TextChoices):
        FOUR_BY_FIFTEEN = '4x15', '4 × 15-minute consultations'
        THREE_BY_TWENTY = '3x20', '3 × 20-minute consultations'

    class Status(models.TextChoices):
        NEW = 'NEW', 'New'
        CONTACTED = 'CONTACTED', 'Contacted'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    full_name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=30, blank=True)
    country = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=15, choices=Role.choices)
    session_format = models.CharField(max_length=4, choices=SessionFormat.choices,
                                      default=SessionFormat.FOUR_BY_FIFTEEN)
    registration_number = models.CharField(
        max_length=100, blank=True,
        help_text='Professional registration or licence number, if the applicant gave one.',
    )
    message = models.TextField(blank=True)

    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW)
    staff_notes = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', 'created_at'])]

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()}) — {self.get_status_display()}"
