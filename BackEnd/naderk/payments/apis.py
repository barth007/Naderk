import json
import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Sum, Count, Q
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.views import APIView

from naderk.common.responses.builders import build_success_response, build_error_response
from .services import (
    initialize_payment, verify_and_confirm, get_provider, provider_public_config,
    confirm_and_fulfill, record_webhook_event,
)

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
                pub = provider_public_config(existing_txn.provider)
                data = {
                    'reference':         existing_txn.reference,
                    'authorization_url': '',   # popup can reuse access_code
                    'access_code':       existing_txn.raw_response.get('access_code', ''),
                    'public_key':        pub.get('public_key', ''),
                    'public_config':     pub,
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
            'public_key':       result.public_config.get('public_key', ''),
            'public_config':    result.public_config,
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
                pub = provider_public_config(existing_txn.provider)
                return build_success_response("Payment already initialized", {
                    'reference':         existing_txn.reference,
                    'access_code':       existing_txn.raw_response.get('access_code', ''),
                    'authorization_url': '',
                    'public_key':        pub.get('public_key', ''),
                    'public_config':     pub,
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
            'public_key':        result.public_config.get('public_key', ''),
            'public_config':     result.public_config,
            'provider':          provider_name,
            'appointment_id':    str(appointment.id),
        })


class VerifyAppointmentPaymentApi(APIView):
    """
    POST /api/v1/payments/verify-appointment/  { "reference": "NDK-..." }

    Confirms a payment straight from the browser after Paystack's inline popup
    reports success, by verifying the reference against Paystack server-side.

    Previously the webhook was the *only* thing that could mark an appointment
    paid. A Paystack account has one webhook URL, so staging and production
    cannot both receive it — on whichever environment misses out, the patient
    paid and then watched a spinner forever because payment_status never left
    PENDING. This endpoint removes that single point of failure; the webhook
    stays as the backstop for patients who close the tab mid-payment.

    Safe to call repeatedly: the underlying transition is idempotent, and the
    reference is verified with Paystack rather than trusted from the client.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        reference = (request.data.get('reference') or '').strip()
        if not reference:
            return build_error_response("validation-error", "reference is required", 400,
                                        "Provide the Paystack transaction reference.")

        from .models import PaymentTransaction
        from naderk.appointments.models import Appointment
        from .services import confirm_appointment_payment

        try:
            txn = PaymentTransaction.objects.select_related('appointment').get(
                reference=reference, user=request.user,
            )
        except PaymentTransaction.DoesNotExist:
            return build_error_response("not-found", "Transaction not found", 404,
                                        "No payment found for that reference.")

        if not txn.appointment:
            return build_error_response("bad-request", "Not an appointment payment", 400,
                                        "That reference is not linked to an appointment.")

        appointment = txn.appointment

        # Already settled (webhook may have won the race) — report success.
        if appointment.payment_status == Appointment.PaymentStatus.PAID:
            return build_success_response("Payment already confirmed", {
                'payment_status': appointment.payment_status,
                'appointment_id': str(appointment.id),
            })

        try:
            result = confirm_and_fulfill(reference=reference)
        except Exception as e:
            logger.exception("Verify failed for %s: %s", reference, e)
            return build_error_response("provider-error", "Could not verify payment", 502,
                                        "We could not reach the payment provider. "
                                        "If you were charged, your booking will be confirmed shortly.")

        appointment.refresh_from_db()
        if appointment.payment_status != Appointment.PaymentStatus.PAID:
            return build_success_response("Payment not successful", {
                'payment_status': appointment.payment_status,
                'provider_status': getattr(result, 'status', None),
                'appointment_id': str(appointment.id),
            })

        logger.info("Verify: appointment %s marked PAID via client verification.", appointment.id)
        return build_success_response("Payment confirmed", {
            'payment_status': appointment.payment_status,
            'appointment_id': str(appointment.id),
        })


class VerifyOrderPaymentApi(APIView):
    """
    POST /api/v1/payments/verify-order/  { "reference": "NDK-..." }

    Marketplace counterpart of VerifyAppointmentPaymentApi. Confirms an order
    payment straight from the browser after Paystack's popup reports success,
    so stock is deducted and the order leaves PENDING without depending on the
    single Paystack webhook URL reaching this environment. The webhook remains
    the backstop; both paths are idempotent (order_process_payment early-returns
    once the order is PAID).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        reference = (request.data.get('reference') or '').strip()
        if not reference:
            return build_error_response("validation-error", "reference is required", 400,
                                        "Provide the Paystack transaction reference.")

        from .models import PaymentTransaction
        from naderk.ecommerce.models import Order
        from naderk.ecommerce.services import order_process_payment

        try:
            txn = PaymentTransaction.objects.select_related('order').get(
                reference=reference, user=request.user,
            )
        except PaymentTransaction.DoesNotExist:
            return build_error_response("not-found", "Transaction not found", 404,
                                        "No payment found for that reference.")

        if not txn.order:
            return build_error_response("bad-request", "Not an order payment", 400,
                                        "That reference is not linked to an order.")

        order = txn.order

        # Already settled (webhook may have won the race) — report success.
        if order.payment_status == Order.PaymentStatus.PAID:
            return build_success_response("Payment already confirmed", {
                'payment_status': order.payment_status,
                'status': order.status,
                'order_id': str(order.id),
            })

        try:
            result = confirm_and_fulfill(reference=reference)
        except Exception as e:
            logger.exception("Verify failed for order ref %s: %s", reference, e)
            return build_error_response("provider-error", "Could not verify payment", 502,
                                        "We could not reach the payment provider. "
                                        "If you were charged, your order will be confirmed shortly.")

        order.refresh_from_db()
        if order.payment_status != Order.PaymentStatus.PAID:
            return build_success_response("Payment not successful", {
                'payment_status': order.payment_status,
                'provider_status': getattr(result, 'status', None),
                'order_id': str(order.id),
            })

        logger.info("Verify: order %s marked PAID via client verification.", order.id)
        return build_success_response("Payment confirmed", {
            'payment_status': order.payment_status,
            'status': order.status,
            'order_id': str(order.id),
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

        # Verify webhook signature before recording anything.
        provider = get_provider('PAYSTACK')
        if not provider.verify_webhook(payload=raw_body, signature=signature):
            logger.warning("Paystack webhook: invalid signature")
            return build_error_response("forbidden", "Invalid signature", 400, "Webhook signature mismatch.")

        # Record (dedup-enforced) and process asynchronously — acknowledge fast.
        # The task re-verifies against the Paystack API before fulfilling; the
        # payload is never trusted on its own.
        record_webhook_event(provider_name='PAYSTACK', raw_body=raw_body, signature_valid=True)
        return build_success_response("Webhook received", {})

        return build_success_response("Webhook processed", {})


ADMIN_ROLES = {'ADMIN', 'SUPER_ADMIN'}


class AdminBillingSummaryApi(APIView):
    """
    GET /api/v1/payments/admin/summary/
    Returns aggregated billing stats for the admin billing dashboard.
    Supports ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD for date filtering.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ADMIN_ROLES:
            return build_error_response("forbidden", "Access denied", 403, "Admin access required.")
        from .models import PaymentTransaction

        qs = PaymentTransaction.objects.all()

        date_from = request.query_params.get('date_from')
        date_to   = request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        successful = qs.filter(status=PaymentTransaction.Status.SUCCESS)
        agg = successful.aggregate(
            total_revenue=Sum('amount_kobo'),
            appt_revenue=Sum('amount_kobo', filter=Q(appointment__isnull=False)),
            order_revenue=Sum('amount_kobo', filter=Q(order__isnull=False)),
        )

        pending_count = qs.filter(status=PaymentTransaction.Status.INITIATED).count()
        failed_count  = qs.filter(status__in=[
            PaymentTransaction.Status.FAILED,
            PaymentTransaction.Status.ABANDONED,
        ]).count()

        # Overdue: INITIATED transactions older than 24 hours
        overdue_threshold = timezone.now() - timedelta(hours=24)
        overdue_qs = qs.filter(
            status=PaymentTransaction.Status.INITIATED,
            created_at__lt=overdue_threshold,
        )
        overdue_agg = overdue_qs.aggregate(total=Sum('amount_kobo'))

        data = {
            'total_revenue_kobo':          agg['total_revenue'] or 0,
            'appointment_revenue_kobo':    agg['appt_revenue'] or 0,
            'order_revenue_kobo':          agg['order_revenue'] or 0,
            'pending_count':               pending_count,
            'failed_count':                failed_count,
            'overdue_invoice_amount_kobo': overdue_agg['total'] or 0,
        }
        return build_success_response("Billing summary", data)


class AdminTransactionListApi(APIView):
    """
    GET /api/v1/payments/admin/transactions/
    Paginated transaction list with filters.
    Query params: type (appointment|order|all), status, date_from, date_to, page, page_size
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ADMIN_ROLES:
            return build_error_response("forbidden", "Access denied", 403, "Admin access required.")
        from .models import PaymentTransaction

        qs = (
            PaymentTransaction.objects
            .select_related('user', 'appointment__service', 'order')
            .order_by('-created_at')
        )

        txn_type  = request.query_params.get('type', 'all')
        status    = request.query_params.get('status', '')
        date_from = request.query_params.get('date_from', '')
        date_to   = request.query_params.get('date_to', '')

        if txn_type == 'appointment':
            qs = qs.filter(appointment__isnull=False)
        elif txn_type == 'order':
            qs = qs.filter(order__isnull=False)

        if status:
            qs = qs.filter(status=status.upper())

        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        try:
            page      = max(1, int(request.query_params.get('page', 1)))
            page_size = max(1, min(100, int(request.query_params.get('page_size', 10))))
        except (TypeError, ValueError):
            page, page_size = 1, 10

        total = qs.count()
        start = (page - 1) * page_size
        txns  = qs[start:start + page_size]

        results = []
        for txn in txns:
            if txn.appointment:
                type_label   = 'APPOINTMENT'
                service_desc = txn.appointment.service.name if txn.appointment.service else '—'
            elif txn.order:
                type_label   = 'ORDER'
                service_desc = f"Marketplace Order #{str(txn.order.id)[:8].upper()}"
            else:
                type_label   = 'OTHER'
                service_desc = '—'

            patient = txn.user
            results.append({
                'id':                  str(txn.id),
                'reference':           txn.reference,
                'patient_name':        patient.get_full_name() or patient.email,
                'patient_email':       patient.email,
                'type':                type_label,
                'service_description': service_desc,
                'insurance':           getattr(patient, 'insurance_provider', None) or '—',
                'amount_kobo':         txn.amount_kobo,
                'currency':            txn.currency,
                'status':              txn.status,
                'provider':            txn.provider,
                'created_at':          txn.created_at.isoformat(),
            })

        return build_success_response("Transactions", {
            'count':      total,
            'page':       page,
            'page_size':  page_size,
            'total_pages': (total + page_size - 1) // page_size,
            'results':    results,
        })


# ─── Payment Gateways (admin config + public list) ────────────────────────────

from naderk.common.permissions import area_forbidden, AREA_SETTINGS
from .models import PaymentGateway, PaymentProviderChoices


def _serialize_gateway_admin(gw: PaymentGateway) -> dict:
    secret = gw.get_secret_key() if gw.has_secret_key else ''
    return {
        'id':             str(gw.id),
        'provider':       gw.provider,
        'mode':           gw.mode,
        'display_name':   gw.display_name,
        'is_active':      gw.is_active,
        'is_default':     gw.is_default,
        'client_key':     gw.client_key,          # public-ish (Paystack public / Monnify API key)
        'contract_code':  gw.contract_code,
        'has_secret_key': gw.has_secret_key,
        'secret_key_hint': ('••••' + secret[-4:]) if secret else '',
        'config':         gw.config or {},
        'updated_at':     gw.updated_at.isoformat(),
    }


def _gateway_public_config(gw: PaymentGateway) -> dict:
    """Client-safe config for the checkout SDK — never the secret key."""
    if gw.provider == PaymentProviderChoices.MONNIFY:
        return {'apiKey': gw.client_key, 'contractCode': gw.contract_code, 'isTestMode': gw.mode == PaymentGateway.Mode.TEST}
    return {'public_key': gw.client_key}


class AdminGatewayListApi(APIView):
    """GET list / POST create payment gateways. Admin-only (settings area)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if (resp := area_forbidden(request, AREA_SETTINGS)):
            return resp
        gateways = PaymentGateway.objects.all()
        return build_success_response("Gateways retrieved", [_serialize_gateway_admin(g) for g in gateways])

    def post(self, request):
        if (resp := area_forbidden(request, AREA_SETTINGS)):
            return resp
        data = request.data
        provider = (data.get('provider') or '').upper()
        mode = (data.get('mode') or 'TEST').upper()
        if provider not in PaymentProviderChoices.values:
            return build_error_response("validation-error", "Invalid provider", 400, "Unknown payment provider.")
        if mode not in PaymentGateway.Mode.values:
            return build_error_response("validation-error", "Invalid mode", 400, "mode must be TEST or LIVE.")
        if PaymentGateway.objects.filter(provider=provider, mode=mode).exists():
            return build_error_response("conflict", "Gateway exists", 409,
                                        f"A {provider} ({mode}) gateway already exists — edit it instead.")
        gw = PaymentGateway(
            provider=provider,
            mode=mode,
            display_name=(data.get('display_name') or provider.title()).strip(),
            client_key=(data.get('client_key') or '').strip(),
            contract_code=(data.get('contract_code') or '').strip(),
            is_active=bool(data.get('is_active', False)),
            is_default=bool(data.get('is_default', False)),
            config=data.get('config') or {},
        )
        if data.get('secret_key'):
            gw.set_secret_key(str(data['secret_key']).strip())
        gw.save()
        return build_success_response("Gateway created", _serialize_gateway_admin(gw), status_code=201)


class AdminGatewayDetailApi(APIView):
    """PATCH update / DELETE a payment gateway. Admin-only (settings area)."""
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if (resp := area_forbidden(request, AREA_SETTINGS)):
            return resp
        try:
            gw = PaymentGateway.objects.get(pk=pk)
        except PaymentGateway.DoesNotExist:
            return build_error_response("not-found", "Gateway not found", 404, "Invalid gateway id.")
        data = request.data
        for field in ('display_name', 'client_key', 'contract_code'):
            if field in data:
                setattr(gw, field, (data.get(field) or '').strip())
        if 'is_active' in data:
            gw.is_active = bool(data['is_active'])
        if 'is_default' in data:
            gw.is_default = bool(data['is_default'])
        if 'config' in data and isinstance(data['config'], dict):
            gw.config = data['config']
        # Write-only secret: only replace when a non-empty value is supplied.
        if data.get('secret_key'):
            gw.set_secret_key(str(data['secret_key']).strip())
        gw.save()
        return build_success_response("Gateway updated", _serialize_gateway_admin(gw))

    def delete(self, request, pk):
        if (resp := area_forbidden(request, AREA_SETTINGS)):
            return resp
        deleted, _ = PaymentGateway.objects.filter(pk=pk).delete()
        if not deleted:
            return build_error_response("not-found", "Gateway not found", 404, "Invalid gateway id.")
        return build_success_response("Gateway deleted", {})


class GatewayListApi(APIView):
    """GET active gateways with client-safe config only (for checkout)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        gateways = PaymentGateway.objects.filter(is_active=True)
        data = [{
            'provider':      g.provider,
            'display_name':  g.display_name,
            'mode':          g.mode,
            'is_default':    g.is_default,
            'public_config': _gateway_public_config(g),
        } for g in gateways]
        return build_success_response("Active gateways", data)
