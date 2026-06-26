from uuid import uuid4

from .models import PaymentTransaction
from .providers.base import PaymentProvider, PaymentInitResult, PaymentVerifyResult
from .providers.paystack import PaystackProvider

# Registry — add new providers here as they are implemented
PROVIDERS: dict[str, type[PaymentProvider]] = {
    'PAYSTACK': PaystackProvider,
}


def get_provider(name: str = 'PAYSTACK') -> PaymentProvider:
    cls = PROVIDERS.get(name.upper())
    if cls is None:
        raise ValueError(f"Unknown payment provider: {name!r}. Available: {list(PROVIDERS)}")
    return cls()


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
    provider_name: str = 'PAYSTACK',
) -> PaymentVerifyResult:
    """
    Verify a payment reference with the provider and persist the result.
    Raises ValueError if the transaction record doesn't exist or verification fails at the HTTP level.
    """
    provider = get_provider(provider_name)
    result = provider.verify(reference=reference)

    new_status = (
        PaymentTransaction.Status.SUCCESS
        if result.status == 'success'
        else PaymentTransaction.Status.FAILED
        if result.status == 'failed'
        else PaymentTransaction.Status.ABANDONED
    )

    PaymentTransaction.objects.filter(reference=reference).update(
        status=new_status,
        raw_response=result.metadata,
    )
    return result
