import datetime

from django.utils import timezone
from celery import shared_task

from .models import Order, OrderActivity

#: How long an unpaid order may sit before it is treated as abandoned.
#: Checkout persists the Order *before* the payment popup opens, so a closed
#: popup or dropped connection leaves an unpaid PENDING row behind, holding
#: reserved stock. Matches
#: ABANDONED_UNPAID_MINUTES in naderk/appointments/tasks.py.
ABANDONED_UNPAID_MINUTES = 30


@shared_task
def cancel_abandoned_unpaid_orders():
    """
    Cancel orders whose checkout was never completed.

    Checkout reserves the order's stock, so an abandoned order is holding
    units nobody is going to buy; this gives them back. It also stops the order
    sitting on the patient's Orders page as an ordinary pending order forever.

    The mirror of cancel_abandoned_unpaid_appointments; orders simply had no
    equivalent backstop.
    """
    from django.db import transaction
    from .services import order_release_stock

    cutoff = timezone.now() - datetime.timedelta(minutes=ABANDONED_UNPAID_MINUTES)
    stale_ids = list(
        Order.objects.unpaid_checkouts().filter(created_at__lt=cutoff).values_list('id', flat=True)
    )

    cancelled = 0
    for order_id in stale_ids:
        with transaction.atomic():
            # Re-check under a lock: a payment may have landed since the query.
            order = (
                Order.objects.select_for_update()
                .unpaid_checkouts().filter(pk=order_id).first()
            )
            if order is None:
                continue
            order_release_stock(order)
            order.status = Order.Status.CANCELLED
            order.payment_status = Order.PaymentStatus.FAILED
            order.save(update_fields=['status', 'payment_status', 'updated_at'])
            # Order has no cancellation_reason column; OrderActivity is the audit trail.
            OrderActivity.objects.create(
                order=order,
                actor=None,
                action='CANCELLED',
                metadata={
                    'reason': 'Payment was not completed.',
                    'cancelled_by': 'system',
                    'abandoned_after_minutes': ABANDONED_UNPAID_MINUTES,
                },
            )
            cancelled += 1

    return f"Cancelled {cancelled} abandoned unpaid orders."
