import datetime

from django.utils import timezone
from celery import shared_task

from .models import Order, OrderActivity

#: How long an unpaid order may sit before it is treated as abandoned.
#: Checkout persists the Order *before* the payment popup opens, so a closed
#: popup or dropped connection leaves an unpaid PENDING row behind. Matches
#: ABANDONED_UNPAID_MINUTES in naderk/appointments/tasks.py.
ABANDONED_UNPAID_MINUTES = 30


@shared_task
def cancel_abandoned_unpaid_orders():
    """
    Cancel orders whose checkout was never completed.

    Stock is deducted in `order_process_payment`, i.e. only once payment is
    confirmed — so an abandoned order holds no stock and is purely a stale row.
    Without this it sat on the patient's Orders page as an ordinary pending
    order forever, which reads as a completed purchase that failed to reduce
    inventory.

    The mirror of cancel_abandoned_unpaid_appointments; orders simply had no
    equivalent backstop.
    """
    cutoff = timezone.now() - datetime.timedelta(minutes=ABANDONED_UNPAID_MINUTES)

    stale = Order.objects.unpaid_checkouts().filter(created_at__lt=cutoff)
    stale_ids = list(stale.values_list('id', flat=True))
    if not stale_ids:
        return "Cancelled 0 abandoned unpaid orders."

    cancelled = Order.objects.filter(id__in=stale_ids).update(
        status=Order.Status.CANCELLED,
        payment_status=Order.PaymentStatus.FAILED,
    )

    # Order has no cancellation_reason column; OrderActivity is the audit trail.
    OrderActivity.objects.bulk_create([
        OrderActivity(
            order_id=order_id,
            actor=None,
            action='CANCELLED',
            metadata={
                'reason': 'Payment was not completed.',
                'cancelled_by': 'system',
                'abandoned_after_minutes': ABANDONED_UNPAID_MINUTES,
            },
        )
        for order_id in stale_ids
    ])

    return f"Cancelled {cancelled} abandoned unpaid orders."
