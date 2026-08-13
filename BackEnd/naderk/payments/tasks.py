import datetime
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

#: Give the webhook a chance to land before we go asking the provider ourselves.
RECONCILE_MIN_AGE_MINUTES = 5

#: Beyond this, a still-INITIATED transaction was almost certainly abandoned at
#: the popup. Re-checking them forever would hammer the provider for nothing.
RECONCILE_MAX_AGE_DAYS = 7

#: Cap per run so a backlog can't turn into a long-running task.
RECONCILE_BATCH_SIZE = 100


@shared_task
def reconcile_pending_transactions():
    """
    Ask the provider about payments we never heard back on.

    `PaymentTransaction.status` only left INITIATED inside the Paystack webhook.
    A Paystack account has a single webhook URL, so staging and production
    cannot both receive it — on whichever one misses out, every real payment sat
    at INITIATED, which the admin billing page renders as "Pending". Money had
    moved and the record said otherwise.

    Payments are now confirmed from the browser too (see
    VerifyAppointmentPaymentApi), but that only helps if the patient's tab stays
    open long enough. This sweep is the safety net: it verifies anything still
    outstanding directly against the provider and applies the same transitions,
    so a missed webhook self-heals instead of leaving the books wrong.
    """
    from .models import PaymentTransaction
    from .services import confirm_and_fulfill

    now = timezone.now()
    stale = PaymentTransaction.objects.filter(
        status=PaymentTransaction.Status.INITIATED,
        created_at__lt=now - datetime.timedelta(minutes=RECONCILE_MIN_AGE_MINUTES),
        created_at__gt=now - datetime.timedelta(days=RECONCILE_MAX_AGE_DAYS),
    ).select_related('appointment__service', 'appointment__patient', 'order', 'user')[:RECONCILE_BATCH_SIZE]

    confirmed = 0
    checked = 0

    for txn in stale:
        checked += 1
        try:
            # Verifies against the provider, then confirms + fulfills (idempotent).
            result = confirm_and_fulfill(reference=txn.reference, provider_name=txn.provider)
        except Exception as e:
            # A provider hiccup on one reference must not abandon the batch.
            logger.warning("Reconcile: verify failed for %s: %s", txn.reference, e)
            continue
        if result and result.status == 'success':
            confirmed += 1

    return f"Reconciled {checked} pending transactions, confirmed {confirmed}."


@shared_task
def process_payment_webhook(event_id):
    """
    Process a recorded PaymentWebhookEvent: verify against the provider API and
    confirm + fulfill. Idempotent — safe to retry; already-processed events and
    duplicate confirmations are no-ops.
    """
    from .models import PaymentWebhookEvent
    from .services import confirm_and_fulfill

    ev = PaymentWebhookEvent.objects.filter(pk=event_id).first()
    if ev is None or ev.processing_status == PaymentWebhookEvent.ProcessingStatus.PROCESSED:
        return

    if not ev.payment_reference:
        ev.processing_status = PaymentWebhookEvent.ProcessingStatus.IGNORED
        ev.processed_at = timezone.now()
        ev.save(update_fields=['processing_status', 'processed_at'])
        return

    try:
        confirm_and_fulfill(reference=ev.payment_reference, provider_name=ev.provider)
        ev.processing_status = PaymentWebhookEvent.ProcessingStatus.PROCESSED
        ev.error_message = ''
    except Exception as e:
        logger.exception("Webhook %s processing failed: %s", event_id, e)
        ev.processing_status = PaymentWebhookEvent.ProcessingStatus.FAILED
        ev.error_message = str(e)
    ev.processed_at = timezone.now()
    ev.save(update_fields=['processing_status', 'processed_at', 'error_message'])
