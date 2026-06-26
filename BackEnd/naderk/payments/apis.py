import json
import logging

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

from naderk.common.responses.builders import build_success_response, build_error_response
from .services import initialize_payment, verify_and_confirm, get_provider

logger = logging.getLogger(__name__)


class InitializePaymentApi(APIView):
    """
    POST /api/v1/payments/initialize/

    Creates an unpaid order from the user's cart, then initialises a payment
    session with the provider. Returns the provider credentials the frontend
    needs to open the payment popup, plus the order_id to poll for completion.

    Flow:
      1. Frontend sends { shipping_address, amount_kobo, email? }
      2. Backend creates Order (PENDING / UNPAID) from cart
      3. Backend calls Paystack to get reference + access_code
      4. Frontend opens Paystack popup using those credentials
      5. Paystack calls our webhook on success → order is confirmed
      6. Frontend polls GET /marketplace/orders/{order_id}/ until payment_status=PAID
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        shipping_address  = request.data.get('shipping_address', '').strip()
        amount_kobo       = request.data.get('amount_kobo')
        email             = request.data.get('email') or request.user.email
        provider_name     = request.data.get('provider', 'PAYSTACK').upper()
        idempotency_key   = request.headers.get('Idempotency-Key', '').strip()

        # If frontend sent an idempotency key and we already have a transaction for it,
        # return the same credentials — safe to retry without creating a second order.
        if idempotency_key:
            from .models import PaymentTransaction
            existing_txn = (
                PaymentTransaction.objects
                .select_related('order')
                .filter(idempotency_key=idempotency_key, user=request.user)
                .first()
            )
            if existing_txn and existing_txn.order:
                logger.info("Idempotency hit for key %s — returning cached response", idempotency_key)
                data = {
                    'reference':         existing_txn.reference,
                    'authorization_url': '',   # popup can reuse access_code
                    'access_code':       existing_txn.raw_response.get('access_code', ''),
                    'public_key':        getattr(settings, 'PAYSTACK_PUBLIC_KEY', ''),
                    'provider':          existing_txn.provider,
                    'order_id':          str(existing_txn.order.id),
                }
                return build_success_response("Payment already initialized", data)

        if not shipping_address:
            return build_error_response("validation-error", "shipping_address is required", 400,
                                        "Provide a delivery address before proceeding to payment.")
        if not amount_kobo:
            return build_error_response("validation-error", "amount_kobo is required", 400,
                                        "Provide amount in kobo (e.g. 50000 = ₦500).")
        try:
            amount_kobo = int(amount_kobo)
        except (TypeError, ValueError):
            return build_error_response("validation-error", "Invalid amount", 400,
                                        "amount_kobo must be an integer.")

        # Step 1 — create the order from the cart (unpaid, holds items + address)
        from naderk.ecommerce.services import order_create_from_cart
        from naderk.ecommerce.models import Cart
        try:
            cart = Cart.objects.get(user=request.user)
            if not cart.items.exists():
                return build_error_response("bad-request", "Cart is empty", 400,
                                            "Add items to your cart before checking out.")
        except Cart.DoesNotExist:
            return build_error_response("bad-request", "Cart not found", 404,
                                        "No active cart found for this user.")

        try:
            order = order_create_from_cart(
                user=request.user,
                shipping_address=shipping_address,
                payment_reference=None,   # not paid yet — webhook will confirm
            )
        except Exception as e:
            logger.exception("Order creation failed during payment init: %s", e)
            return build_error_response("server-error", "Could not create order", 500, str(e))

        # Step 2 — initialise payment with provider, linking the order
        try:
            result = initialize_payment(
                user=request.user,
                amount_kobo=amount_kobo,
                email=email,
                order=order,
                provider_name=provider_name,
                idempotency_key=idempotency_key or None,
            )
        except ValueError as e:
            return build_error_response("bad-request", str(e), 400, str(e))
        except Exception as e:
            logger.exception("Payment initialization failed: %s", e)
            return build_error_response("provider-error", "Payment initialization failed", 502, str(e))

        data = {
            'reference':        result.reference,
            'authorization_url': result.authorization_url,
            'access_code':      result.access_code,
            'public_key':       getattr(settings, 'PAYSTACK_PUBLIC_KEY', ''),
            'provider':         provider_name,
            'order_id':         str(order.id),   # frontend polls this
        }
        return build_success_response("Payment initialized successfully", data)


class InitializeAppointmentPaymentApi(APIView):
    """
    POST /api/v1/payments/initialize-appointment/

    Initialises a Paystack payment session for a booked appointment that is
    still awaiting payment. The appointment must belong to the requesting user
    and have payment_status=PENDING with a non-zero consultation_fee.

    Flow:
      1. Frontend sends { appointment_id, provider? }
      2. Backend fetches appointment, validates fee > 0
      3. Backend calls Paystack to get reference + access_code
      4. Frontend opens Paystack popup → Paystack webhook confirms payment
      5. Frontend polls GET /appointments/{id}/ until payment_status=PAID
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        appointment_id  = request.data.get('appointment_id')
        provider_name   = request.data.get('provider', 'PAYSTACK').upper()
        idempotency_key = request.headers.get('Idempotency-Key', '').strip()
        email           = request.user.email

        if not appointment_id:
            return build_error_response("validation-error", "appointment_id is required", 400, "Provide the appointment ID.")

        from naderk.appointments.models import Appointment
        try:
            appointment = Appointment.objects.select_related('service').get(
                id=appointment_id, patient=request.user
            )
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID.")

        if appointment.payment_status == Appointment.PaymentStatus.PAID:
            return build_error_response("conflict", "Already paid", 409, "This appointment has already been paid for.")

        if appointment.consultation_fee <= 0:
            return build_error_response("bad-request", "No payment required", 400, "This appointment has no consultation fee.")

        # Idempotency check — return cached creds if the same key was used before
        if idempotency_key:
            from .models import PaymentTransaction
            existing_txn = (
                PaymentTransaction.objects
                .filter(idempotency_key=idempotency_key, user=request.user)
                .first()
            )
            if existing_txn:
                logger.info("Idempotency hit for key %s — returning cached appointment payment response", idempotency_key)
                return build_success_response("Payment already initialized", {
                    'reference':         existing_txn.reference,
                    'access_code':       existing_txn.raw_response.get('access_code', ''),
                    'authorization_url': '',
                    'public_key':        getattr(settings, 'PAYSTACK_PUBLIC_KEY', ''),
                    'provider':          existing_txn.provider,
                    'appointment_id':    str(appointment.id),
                })

        amount_kobo = int(appointment.consultation_fee * 100)

        try:
            result = initialize_payment(
                user=request.user,
                amount_kobo=amount_kobo,
                email=email,
                appointment=appointment,
                provider_name=provider_name,
                idempotency_key=idempotency_key or None,
            )
        except ValueError as e:
            return build_error_response("bad-request", str(e), 400, str(e))
        except Exception as e:
            logger.exception("Appointment payment initialization failed: %s", e)
            return build_error_response("provider-error", "Payment initialization failed", 502, str(e))

        return build_success_response("Payment initialized successfully", {
            'reference':         result.reference,
            'authorization_url': result.authorization_url,
            'access_code':       result.access_code,
            'public_key':        getattr(settings, 'PAYSTACK_PUBLIC_KEY', ''),
            'provider':          provider_name,
            'appointment_id':    str(appointment.id),
        })


@method_decorator(csrf_exempt, name='dispatch')
class PaystackWebhookApi(APIView):
    """
    POST /api/v1/payments/webhook/paystack/

    Paystack calls this endpoint when a payment event occurs.
    On charge.success: verify the payment, then process the linked order.
    This is the authoritative source of truth — the order only transitions
    to PAID here, not in the frontend callback.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        raw_body  = request.body
        signature = request.headers.get('x-paystack-signature', '')

        # Verify webhook signature
        provider = get_provider('PAYSTACK')
        if not provider.verify_webhook(payload=raw_body, signature=signature):
            logger.warning("Paystack webhook: invalid signature")
            return build_error_response("forbidden", "Invalid signature", 400, "Webhook signature mismatch.")

        try:
            payload = json.loads(raw_body)
        except json.JSONDecodeError:
            return build_error_response("bad-request", "Invalid JSON", 400, "Could not parse webhook body.")

        event = payload.get('event')
        logger.info("Paystack webhook event received: %s", event)

        if event != 'charge.success':
            return build_success_response("Event acknowledged", {})

        reference = payload.get('data', {}).get('reference')
        if not reference:
            return build_error_response("bad-request", "Missing reference", 400, "No reference in webhook payload.")

        # Verify with Paystack API (double-check, don't trust payload alone)
        try:
            result = verify_and_confirm(reference=reference, provider_name='PAYSTACK')
        except Exception as e:
            logger.exception("Webhook verify failed for %s: %s", reference, e)
            return build_success_response("Received (verification error — see logs)", {})

        if result.status != 'success':
            logger.warning("Webhook: payment %s status is %s, not processing order.", reference, result.status)
            return build_success_response("Payment not successful", {})

        # Process the linked order
        from .models import PaymentTransaction
        from naderk.ecommerce.services import order_process_payment
        try:
            txn = PaymentTransaction.objects.select_related('order', 'user').get(reference=reference)
        except PaymentTransaction.DoesNotExist:
            logger.warning("Webhook: no PaymentTransaction for reference %s", reference)
            return build_success_response("Transaction not found", {})

        if txn.appointment:
            from django.db import transaction as db_transaction
            from naderk.appointments.models import Appointment
            from naderk.appointments.services import ConsultationService
            appt = txn.appointment
            if appt.payment_status == 'PAID':
                logger.info("Webhook: appointment %s already paid, skipping.", appt.id)
                return build_success_response("Already processed", {})
            try:
                with db_transaction.atomic():
                    appt.payment_status = Appointment.PaymentStatus.PAID
                    appt.payment_reference = reference
                    # status stays PENDING — doctor must still accept the request.
                    # DoctorRequestsAPI only surfaces paid (or free) pending appointments.
                    appt.save()
                    ConsultationService.create_service_plan(
                        patient=appt.patient,
                        service=appt.service,
                        payment_reference=reference,
                    )
                logger.info("Webhook: appointment %s marked PAID, awaiting doctor acceptance.", appt.id)
            except Exception as e:
                logger.exception("Webhook: appointment processing failed for %s: %s", reference, e)
        elif txn.order:
            if txn.order.payment_status == 'PAID':
                logger.info("Webhook: order %s already paid, skipping.", txn.order.id)
                return build_success_response("Already processed", {})
            try:
                order_process_payment(
                    order=txn.order,
                    actor=txn.user,
                    payment_reference=reference,
                    skip_verify=True,
                )
                logger.info("Webhook: order %s successfully marked PAID.", txn.order.id)
            except Exception as e:
                logger.exception("Webhook: order processing failed for %s: %s", reference, e)
        else:
            logger.warning("Webhook: transaction %s has no linked order or appointment", reference)

        return build_success_response("Webhook processed", {})
