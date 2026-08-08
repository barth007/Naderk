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
    from .services import verify_and_confirm, confirm_appointment_payment

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
            # Updates PaymentTransaction.status as a side effect.
            result = verify_and_confirm(reference=txn.reference, provider_name=txn.provider)
        except Exception as e:
            # A provider hiccup on one reference must not abandon the batch.
            logger.warning("Reconcile: verify failed for %s: %s", txn.reference, e)
            continue

        if result.status != 'success':
            continue

        try:
            if txn.appointment:
                if confirm_appointment_payment(appointment=txn.appointment, reference=txn.reference):
                    confirmed += 1
                    logger.info("Reconcile: appointment %s marked PAID from %s",
                                txn.appointment_id, txn.reference)
            elif txn.order:
                from naderk.ecommerce.services import order_process_payment
                if txn.order.payment_status != 'PAID':
                    order_process_payment(
                        order=txn.order, actor=txn.user,
                        payment_reference=txn.reference, skip_verify=True,
                    )
                    confirmed += 1
                    logger.info("Reconcile: order %s marked PAID from %s",
                                txn.order_id, txn.reference)
        except Exception as e:
            logger.exception("Reconcile: could not apply payment for %s: %s", txn.reference, e)

    return f"Reconciled {checked} pending transactions, confirmed {confirmed}."
