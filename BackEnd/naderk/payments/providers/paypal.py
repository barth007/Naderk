"""
PayPal payment provider (Orders v2).

All PayPal URLs, payload shapes and status names live here; the rest of the app
speaks only the normalized PaymentProvider interface.

How a PayPal payment runs:
  * initialize() creates a PayPal order for the amount we priced, tagged with
    our reference (custom_id / invoice_id), and returns its id. The browser
    shows PayPal's buttons for that order; the buyer approves it there.
  * verify() looks the order up and, once the buyer has approved it, captures
    it — the capture is what moves the money. Every confirmation path (the
    browser's verify call, the webhook task, reconcile) goes through verify(),
    so an approved order is captured even if the buyer closes the tab.
  * Amounts are decimal strings in the currency's major unit ("12.50"); we
    convert from and to minor units with Decimal.
  * PayPal does not take Naira.
  * Webhooks are authenticated by asking PayPal to check the transmission
    headers against the configured webhook id (verify_webhook_request).
"""
import logging
from decimal import Decimal

import requests
from django.core.cache import cache

from .base import PaymentProvider, PaymentInitResult, PaymentVerifyResult

logger = logging.getLogger(__name__)

SANDBOX_BASE = "https://api-m.sandbox.paypal.com"
LIVE_BASE = "https://api-m.paypal.com"

#: Of the currencies this app charges in, the ones PayPal accepts.
SUPPORTED_CURRENCIES = {'USD', 'GBP'}

#: Transmission headers PayPal signs a webhook with, as Django exposes them.
WEBHOOK_HEADERS = {
    'auth_algo': 'PAYPAL-AUTH-ALGO',
    'cert_url': 'PAYPAL-CERT-URL',
    'transmission_id': 'PAYPAL-TRANSMISSION-ID',
    'transmission_sig': 'PAYPAL-TRANSMISSION-SIG',
    'transmission_time': 'PAYPAL-TRANSMISSION-TIME',
}


def _major(amount_minor: int) -> str:
    return f"{(Decimal(amount_minor) / 100):.2f}"


def _minor(value) -> int:
    return int((Decimal(str(value or 0)) * 100).to_integral_value())


class PayPalProvider(PaymentProvider):
    def __init__(self, config: dict | None = None):
        config = config or {}
        self.client_id = config.get('client_key', '')
        self.secret = config.get('secret_key', '')
        self.mode = (config.get('mode') or 'TEST').upper()
        self.gateway_id = config.get('gateway_id', 'env')
        extras = config.get('config') or {}
        self.webhook_id = (extras.get('webhook_id') or '').strip()
        self.ngn_per_usd = str(extras.get('ngn_per_usd') or '').strip()
        self.base = SANDBOX_BASE if self.mode == 'TEST' else LIVE_BASE

    # ── Auth ──────────────────────────────────────────────────────────────────
    def _access_token(self) -> str:
        cache_key = f"paypal:{self.gateway_id}:{self.mode}:access_token"
        token = cache.get(cache_key)
        if token:
            return token
        resp = requests.post(
            f"{self.base}/v1/oauth2/token",
            auth=(self.client_id, self.secret),
            data={'grant_type': 'client_credentials'},
            headers={'Accept': 'application/json'},
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json()
        token = body.get('access_token', '')
        expires_in = int(body.get('expires_in', 3600) or 3600)
        cache.set(cache_key, token, timeout=max(60, expires_in - 300))  # refresh a little early
        return token

    def _headers(self, request_id: str = '') -> dict:
        headers = {'Authorization': f"Bearer {self._access_token()}", 'Content-Type': 'application/json'}
        if request_id:
            # Makes a retried create/capture a no-op on PayPal's side.
            headers['PayPal-Request-Id'] = request_id
        return headers

    # ── Interface ───────────────────────────────────────────────────────────────
    def public_config(self) -> dict:
        return {
            'client_id': self.client_id,
            'isTestMode': self.mode == 'TEST',
            'ngn_per_usd': self.ngn_per_usd,
        }

    def initialize(self, *, amount_kobo: int, email: str, reference: str, metadata: dict,
                   currency: str = 'NGN') -> PaymentInitResult:
        currency = (currency or '').upper()
        if currency not in SUPPORTED_CURRENCIES:
            raise ValueError("PayPal takes payments in US dollars or pounds, not "
                             f"{currency or 'this currency'}. Choose another payment method.")
        body = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'reference_id': reference,
                'custom_id': reference,
                'invoice_id': reference,
                'amount': {'currency_code': currency, 'value': _major(amount_kobo)},
            }],
            # We collect any delivery address ourselves, and gifts have none.
            'application_context': {'shipping_preference': 'NO_SHIPPING', 'user_action': 'PAY_NOW'},
        }
        resp = requests.post(f"{self.base}/v2/checkout/orders", json=body,
                             headers=self._headers(request_id=reference), timeout=30)
        resp.raise_for_status()
        order = resp.json()
        approve = next((l['href'] for l in order.get('links', [])
                        if l.get('rel') in ('approve', 'payer-action')), '')
        return PaymentInitResult(
            reference=reference,
            authorization_url=approve,
            provider='PAYPAL',
            provider_reference=order['id'],
            public_config={**self.public_config(), 'order_id': order['id'], 'currency': currency},
        )

    def _order_id_for(self, reference: str) -> str:
        from naderk.payments.models import PaymentTransaction
        order_id = (
            PaymentTransaction.objects.filter(reference=reference)
            .values_list('provider_txn_ref', flat=True).first()
        )
        if not order_id:
            raise ValueError(f"No PayPal order is recorded for payment {reference}.")
        return order_id

    def _get_order(self, order_id: str) -> dict:
        resp = requests.get(f"{self.base}/v2/checkout/orders/{order_id}", headers=self._headers(), timeout=30)
        resp.raise_for_status()
        return resp.json()

    def _capture(self, order_id: str, reference: str) -> dict:
        resp = requests.post(f"{self.base}/v2/checkout/orders/{order_id}/capture", json={},
                             headers=self._headers(request_id=f"{reference}-capture"), timeout=30)
        if resp.status_code == 422:
            # Already captured, or the buyer's card was declined and they need
            # to pick another way to pay. Either way, read where the order is.
            logger.info("PayPal capture of %s refused: %s", order_id, resp.text[:300])
            return self._get_order(order_id)
        resp.raise_for_status()
        return resp.json()

    def verify(self, *, reference: str) -> PaymentVerifyResult:
        order_id = self._order_id_for(reference)
        order = self._get_order(order_id)
        if order.get('status') == 'APPROVED':
            order = self._capture(order_id, reference)

        unit = (order.get('purchase_units') or [{}])[0]
        captures = (unit.get('payments') or {}).get('captures') or []
        capture = captures[0] if captures else {}
        capture_status = (capture.get('status') or '').upper()
        order_status = (order.get('status') or '').upper()

        if capture_status == 'COMPLETED':
            status = 'success'
        elif capture_status in ('DECLINED', 'FAILED') or order_status == 'VOIDED':
            status = 'failed'
        else:
            # CREATED / APPROVED / PAYER_ACTION_REQUIRED, or a PENDING capture
            # (e.g. an eCheck) — not settled yet.
            status = 'abandoned'

        amount = capture.get('amount') or unit.get('amount') or {}
        return PaymentVerifyResult(
            reference=reference,
            status=status,
            amount_kobo=_minor(amount.get('value')) if capture_status == 'COMPLETED' else 0,
            currency=amount.get('currency_code', ''),
            metadata=order,
            # Keep the PayPal order id: later verifies look the order up by it.
            provider_txn_ref=order_id,
        )

    def verify_webhook(self, *, payload: bytes, signature: str) -> bool:
        # PayPal signs with several headers, not one; see verify_webhook_request.
        return False

    def verify_webhook_request(self, *, payload: bytes, headers) -> bool:
        """Ask PayPal whether this delivery really came from it, for our webhook id."""
        import json
        if not self.webhook_id:
            logger.warning("PayPal webhook received but no webhook ID is configured.")
            return False
        values = {key: headers.get(name, '') for key, name in WEBHOOK_HEADERS.items()}
        if not all(values.values()):
            return False
        try:
            event = json.loads(payload or b'{}')
            resp = requests.post(
                f"{self.base}/v1/notifications/verify-webhook-signature",
                json={**values, 'webhook_id': self.webhook_id, 'webhook_event': event},
                headers=self._headers(), timeout=30,
            )
            resp.raise_for_status()
        except (ValueError, requests.RequestException) as e:
            logger.warning("PayPal webhook verification failed: %s", e)
            return False
        return resp.json().get('verification_status') == 'SUCCESS'

    def parse_webhook(self, payload: dict) -> dict:
        resource = payload.get('resource') or {}
        unit = (resource.get('purchase_units') or [{}])[0]
        reference = (
            resource.get('custom_id') or resource.get('invoice_id')            # a capture
            or unit.get('custom_id') or unit.get('reference_id') or ''         # an order
        )
        return {'event_type': payload.get('event_type', ''), 'reference': reference}
