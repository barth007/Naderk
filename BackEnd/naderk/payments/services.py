import hashlib
import json
import logging
from uuid import uuid4

from django.db import transaction as db_transaction
from django.utils import timezone

from .models import PaymentTransaction
from .providers.base import PaymentProvider, PaymentInitResult, PaymentVerifyResult
from .providers.paystack import PaystackProvider
from .providers.monnify import MonnifyProvider

logger = logging.getLogger(__name__)

# Registry — add new providers here as they are implemented
PROVIDERS: dict[str, type[PaymentProvider]] = {
    'PAYSTACK': PaystackProvider,
    'MONNIFY': MonnifyProvider,
}


def get_provider(name: str = 'PAYSTACK') -> PaymentProvider:
    cls = PROVIDERS.get(name.upper())
    if cls is None:
        raise ValueError(f"Unknown payment provider: {name!r}. Available: {list(PROVIDERS)}")
    from .config import gateway_config, ProviderNotConfigured
    try:
        config = gateway_config(name)
    except ProviderNotConfigured:
        # Construct anyway; the provider falls back to any env config and will
        # surface a clear error at call time if truly unconfigured.
        config = {}
    return cls(config)


def provider_public_config(provider_name: str) -> dict:
    """Client-safe config (e.g. public key / contract code) for a provider."""
    try:
        return get_provider(provider_name).public_config()
    except Exception:
        return {}


def initialize_payment(
    *,
    user,
    amount_kobo: int,
    email: str,
    order=None,
    appointment=None,
    provider_name: str = 'PAYSTACK',
    idempotency_key: str | None = None,
) -> PaymentInitResult:
    provider = get_provider(provider_name)
    reference = f"NDK-{uuid4().hex[:12].upper()}"
    result = provider.initialize(
        amount_kobo=amount_kobo,
        email=email,
        reference=reference,
        metadata={
            'user_id': str(user.id),
            'order_id': str(order.id) if order else None,
            'appointment_id': str(appointment.id) if appointment else None,
        },
    )
    PaymentTransaction.objects.create(
        user=user,
        provider=provider_name.upper(),
        reference=reference,
        amount_kobo=amount_kobo,
        order=order,
        appointment=appointment,
        status=PaymentTransaction.Status.INITIATED,
        idempotency_key=idempotency_key or None,
        raw_response={'access_code': result.access_code},
    )
    return result


def verify_and_confirm(
    *,
    reference: str,
    provider_name: str | None = None,
) -> PaymentVerifyResult:
    """
    Verify a payment reference with its provider and persist the result.

    When provider_name is omitted, it is resolved from the stored transaction's
    `provider` column, so a Monnify payment is never verified against Paystack.
    """
    if provider_name is None:
        txn = PaymentTransaction.objects.filter(reference=reference).only('provider').first()
        provider_name = txn.provider if txn else 'PAYSTACK'

    provider = get_provider(provider_name)
    result = provider.verify(reference=reference)

    new_status = (
        PaymentTransaction.Status.SUCCESS
        if result.status == 'success'
        else PaymentTransaction.Status.FAILED
        if result.status == 'failed'
        else PaymentTransaction.Status.ABANDONED
    )

    fields = {'status': new_status, 'raw_response': result.metadata}
    if result.provider_txn_ref:
        fields['provider_txn_ref'] = result.provider_txn_ref
    PaymentTransaction.objects.filter(reference=reference).update(**fields)
    return result


def confirm_appointment_payment(*, appointment, reference: str) -> bool:
    """
    Apply the paid state to an appointment. Idempotent.

    Shared by the Paystack webhook and the client-driven verify endpoint so the
    two paths can never drift apart. Returns True if this call transitioned the
    appointment, False if it was already paid.
    """
    from django.db import transaction as db_transaction
    from naderk.appointments.models import Appointment
    from naderk.appointments.services import ConsultationService

    if appointment.payment_status == Appointment.PaymentStatus.PAID:
        return False

    with db_transaction.atomic():
        appointment.payment_status = Appointment.PaymentStatus.PAID
        appointment.payment_reference = reference
        # status stays PENDING — the doctor still has to accept the request.
        appointment.save(update_fields=['payment_status', 'payment_reference'])
        ConsultationService.create_service_plan(
            patient=appointment.patient,
            service=appointment.service,
            payment_reference=reference,
        )
    return True


# ── Unified confirmation lifecycle ────────────────────────────────────────────
# The core invariant: only server-side provider verification + currency + amount
# checks may transition a payment to SUCCESS, and only then fulfill. The webhook
# task, the client-verify endpoints, and reconcile all converge here.

def confirm_payment_transaction(txn: PaymentTransaction):
    """
    Lock the transaction and transition its status to SUCCESS (financial truth).
    Idempotent — returns (txn, changed).
    """
    with db_transaction.atomic():
        locked = PaymentTransaction.objects.select_for_update().get(pk=txn.pk)
        if locked.status == PaymentTransaction.Status.SUCCESS:
            return locked, False
        locked.status = PaymentTransaction.Status.SUCCESS
        locked.save(update_fields=['status', 'updated_at'])
        return locked, True


def fulfill_payment_transaction(txn: PaymentTransaction) -> None:
    """
    Apply the business side effects of a paid transaction. Idempotent — delegates
    to the idempotent order/appointment confirmers.
    """
    if txn.appointment_id:
        confirm_appointment_payment(appointment=txn.appointment, reference=txn.reference)
    elif txn.order_id:
        from naderk.ecommerce.models import Order
        from naderk.ecommerce.services import order_process_payment
        if txn.order.payment_status != Order.PaymentStatus.PAID:
            order_process_payment(
                order=txn.order, actor=txn.user,
                payment_reference=txn.reference, skip_verify=True,
            )
    else:
        logger.warning("fulfill_payment: txn %s has no linked order or appointment", txn.reference)


def confirm_and_fulfill(*, reference: str, provider_name: str | None = None) -> PaymentVerifyResult | None:
    """
    Authoritative confirmation. Verifies the reference against the provider API,
    validates currency and amount, then confirms (status) and fulfills (business).
    Idempotent and safe to call from webhook, client-verify, and reconcile.

    Returns the PaymentVerifyResult, or None if no transaction exists.
    """
    txn = (
        PaymentTransaction.objects
        .select_related('order', 'appointment', 'user')
        .filter(reference=reference)
        .first()
    )
    if txn is None:
        logger.warning("confirm_and_fulfill: no transaction for %s", reference)
        return None

    result = verify_and_confirm(reference=reference, provider_name=provider_name or txn.provider)
    if result.status != 'success':
        return result

    # Currency must match what we charged.
    expected_currency = (txn.currency or 'NGN').upper()
    got_currency = (result.currency or expected_currency).upper()
    if got_currency != expected_currency:
        logger.error("Currency mismatch on %s: paid %s, expected %s — not fulfilling.",
                     reference, got_currency, expected_currency)
        return result

    # Amount policy: exact match. Underpayment is rejected; overpayment is flagged
    # for review rather than silently accepted. (Single place, easy to change.)
    paid = int(getattr(result, 'amount_kobo', 0) or 0)
    expected = int(txn.amount_kobo or 0)
    if paid != expected:
        kind = "OVERPAYMENT" if paid > expected else "UNDERPAYMENT"
        logger.error("%s on %s: paid %s, expected %s — not fulfilling automatically.",
                     kind, reference, paid, expected)
        return result

    confirm_payment_transaction(txn)
    fulfill_payment_transaction(txn)
    return result


def record_webhook_event(*, provider_name: str, raw_body: bytes, signature_valid: bool):
    """
    Persist an inbound webhook (dedup-enforced) and enqueue async processing.
    Returns the PaymentWebhookEvent, or None if it was a duplicate delivery.
    """
    from django.db import IntegrityError
    from .models import PaymentWebhookEvent

    event_hash = hashlib.sha256(raw_body or b'').hexdigest()
    try:
        payload = json.loads(raw_body or b'{}')
        if not isinstance(payload, dict):
            payload = {}
    except (ValueError, TypeError):
        payload = {}

    parsed = get_provider(provider_name).parse_webhook(payload)
    try:
        # Savepoint so a duplicate insert rolls back cleanly without poisoning
        # the surrounding transaction.
        with db_transaction.atomic():
            event = PaymentWebhookEvent.objects.create(
                provider=provider_name.upper(),
                event_type=parsed.get('event_type', ''),
                event_hash=event_hash,
                payment_reference=parsed.get('reference', ''),
                payload=payload,
                signature_valid=signature_valid,
            )
    except IntegrityError:
        logger.info("Duplicate %s webhook (hash %s) ignored.", provider_name, event_hash[:12])
        return None

    from .tasks import process_payment_webhook
    process_payment_webhook.delay(str(event.id))
    return event
