import datetime
import logging
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import Donation, VolunteerApplication

logger = logging.getLogger(__name__)

#: Smallest and largest single gift, per currency. The floor keeps out
#: card-testing with one-unit charges; the ceiling catches a mistyped amount.
AMOUNT_LIMITS = {
    'NGN': (Decimal('100'), Decimal('50000000')),
    'GBP': (Decimal('1'), Decimal('50000')),
    'USD': (Decimal('1'), Decimal('50000')),
}

#: What a test and an intervention cost, used when the CMS has not set them.
DEFAULT_PRICES = {
    'NGN': {'test': Decimal('9999'), 'intervention': Decimal('20000')},
    'GBP': {'test': Decimal('5'), 'intervention': Decimal('10')},
    'USD': {'test': Decimal('6.50'), 'intervention': Decimal('13')},
}

#: How long before the anniversary of an annual gift the reminder goes out.
REMINDER_LEAD_DAYS = 7

PAGE = 'extend_life_africa'


def _decimal(value):
    try:
        number = Decimal(str(value).replace(',', '').strip())
    except (InvalidOperation, ValueError, TypeError):
        return None
    return number if number > 0 else None


def prices():
    """
    The price of a test and an intervention in each currency.

    Editable in the CMS (Extend Life Africa → Giving); any price left blank or
    unreadable falls back to DEFAULT_PRICES, so the page never loses a price.
    """
    from naderk.cms.models import PageSection

    giving = (
        PageSection.objects.filter(page=PAGE, section_key='giving')
        .values_list('content', flat=True).first()
    ) or {}
    out = {}
    for currency, defaults in DEFAULT_PRICES.items():
        code = currency.lower()
        out[currency] = {
            'test': _decimal(giving.get(f'test_price_{code}')) or defaults['test'],
            'intervention': _decimal(giving.get(f'intervention_price_{code}')) or defaults['intervention'],
        }
    return out


def purpose_for(amount: Decimal, currency: str) -> str:
    """What a gift of this size pays for: an intervention, a test, or the general fund."""
    price = prices()[currency]
    if amount >= price['intervention']:
        return Donation.Purpose.INTERVENTION
    if amount >= price['test']:
        return Donation.Purpose.TEST
    return Donation.Purpose.GENERAL


@transaction.atomic
def start_donation(*, user, donor_name, donor_email, currency, amount, frequency,
                   dedicated_to='', message='', provider_name='PAYSTACK', idempotency_key=None):
    """
    Record a gift and start its payment with the provider.

    One transaction: if the provider refuses to start the payment, no
    half-made donation is left behind.
    """
    from naderk.payments.services import initialize_payment

    donation = Donation.objects.create(
        user=user if getattr(user, 'is_authenticated', False) else None,
        donor_name=donor_name.strip(),
        donor_email=donor_email.strip().lower(),
        currency=currency,
        amount=amount,
        frequency=frequency,
        purpose=purpose_for(amount, currency),
        dedicated_to=(dedicated_to or '').strip(),
        message=(message or '').strip(),
    )
    result = initialize_payment(
        user=donation.user,
        amount_kobo=donation.amount_minor,
        email=donation.donor_email,
        donation=donation,
        currency=currency,
        provider_name=provider_name,
        idempotency_key=idempotency_key,
    )
    return donation, result


def _money(donation) -> str:
    symbol = {'NGN': '₦', 'GBP': '£', 'USD': '$'}[donation.currency]
    amount = donation.amount
    text = f"{amount:,.2f}" if amount != amount.to_integral_value() else f"{amount:,.0f}"
    return f"{symbol}{text}"


def _page_url(anchor='') -> str:
    base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    return f"{base}/extend-life-africa{anchor}"


def confirm_donation_payment(*, donation, reference: str) -> bool:
    """
    Mark a gift paid. Idempotent; called by every payment-confirmation path
    (browser verify, webhook, reconcile) through payments.fulfill_payment_transaction.

    Returns True when this call made the change.
    """
    with transaction.atomic():
        donation = Donation.objects.select_for_update().get(pk=donation.pk)
        if donation.status == Donation.Status.PAID:
            return False

        donation.status = Donation.Status.PAID
        donation.payment_reference = reference
        donation.paid_at = timezone.now()
        if donation.frequency == Donation.Frequency.ANNUAL:
            paid_on = timezone.localdate(donation.paid_at)
            anniversary = _add_a_year(paid_on)
            donation.next_reminder_on = anniversary - datetime.timedelta(days=REMINDER_LEAD_DAYS)
            # Giving again is what the last reminder asked for, so any earlier
            # annual gift from the same donor stops waiting to remind them.
            (Donation.objects
             .filter(donor_email=donation.donor_email, frequency=Donation.Frequency.ANNUAL,
                     next_reminder_on__isnull=False)
             .exclude(pk=donation.pk)
             .update(next_reminder_on=None))
        donation.save(update_fields=['status', 'payment_reference', 'paid_at', 'next_reminder_on', 'updated_at'])

    _send_thank_you(donation)
    return True


def _add_a_year(day: datetime.date) -> datetime.date:
    try:
        return day.replace(year=day.year + 1)
    except ValueError:          # 29 February
        return day.replace(year=day.year + 1, day=28)


def _send_thank_you(donation) -> None:
    """Best effort: the gift is recorded whether or not the email goes."""
    from naderk.common.email.services import email_service

    if donation.frequency == Donation.Frequency.ANNUAL:
        follow_up = (
            f" You chose to give every year, so we will email you a reminder around "
            f"{donation.next_reminder_on:%d %B %Y}. Nothing will be charged automatically."
        )
    else:
        follow_up = ''
    try:
        email_service.send_notification(
            recipient_email=donation.donor_email,
            title='Thank you for extending a life',
            message=(
                f"Dear {donation.donor_name}, we have received your gift of {_money(donation)} "
                f"to Extend Life Africa ({donation.get_purpose_display().lower()}). "
                f"Your payment reference is {donation.payment_reference}.{follow_up}"
            ),
            action_url=_page_url(),
            action_label='See the work you support',
            tags=['donation', 'receipt'],
            metadata={'donation_id': str(donation.id)},
        )
    except Exception:
        logger.exception("Could not send the thank-you email for donation %s", donation.id)


def send_due_reminders(today=None) -> int:
    """
    Email every annual donor whose reminder date has come. Each paid annual
    gift produces one reminder; giving again schedules the next.
    """
    from naderk.common.email.services import email_service

    today = today or timezone.localdate()
    due = Donation.objects.filter(
        frequency=Donation.Frequency.ANNUAL,
        status=Donation.Status.PAID,
        next_reminder_on__lte=today,
        reminder_sent_at__isnull=True,
    )
    sent = 0
    for donation in due:
        try:
            email_service.send_notification(
                recipient_email=donation.donor_email,
                title='A year ago, you extended a life',
                message=(
                    f"Dear {donation.donor_name}, a year ago you gave {_money(donation)} to "
                    f"Extend Life Africa. You asked us to remind you each year — if you would "
                    f"like to give again, it takes a minute."
                ),
                action_url=_page_url('#give'),
                action_label='Give again',
                tags=['donation', 'reminder'],
                metadata={'donation_id': str(donation.id)},
            )
        except Exception:
            logger.exception("Could not send the yearly reminder for donation %s", donation.id)
            continue
        Donation.objects.filter(pk=donation.pk).update(
            reminder_sent_at=timezone.now(), next_reminder_on=None,
        )
        sent += 1
    return sent


def submit_volunteer_application(**fields) -> VolunteerApplication:
    application = VolunteerApplication.objects.create(**fields)
    _tell_the_team(application)
    return application


def _tell_the_team(application) -> None:
    """Email the organisation's general inbox, when the CMS has one set."""
    from naderk.cms.models import SiteSettings
    from naderk.common.email.services import email_service

    inbox = SiteSettings.objects.values_list('email_general', flat=True).first()
    if not inbox:
        return
    base = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    try:
        email_service.send_notification(
            recipient_email=inbox,
            title=f'New volunteer: {application.full_name} ({application.get_role_display()})',
            message=(
                f"{application.full_name} ({application.email}) has offered to volunteer as a "
                f"{application.get_role_display()} for Extend Life Africa, "
                f"{application.get_session_format_display().lower()} a week."
            ),
            action_url=f"{base}/admin/extend-life-africa?tab=volunteers",
            action_label='Review the application',
            tags=['volunteer'],
        )
    except Exception:
        logger.exception("Could not email the team about volunteer application %s", application.id)
