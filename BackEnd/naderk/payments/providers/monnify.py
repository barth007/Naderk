"""
Monnify payment provider.

All Monnify base URLs, API versions, endpoint paths, and payload shapes live
here — the rest of the app speaks only the normalized PaymentProvider interface.

Key differences from Paystack (handled inside this adapter):
  * OAuth: Basic base64(apiKey:secretKey) -> Bearer access token (cached ~1h).
  * Amounts are in Naira, not kobo (we convert with Decimal).
  * A contract_code is required.
  * Client pays via the inline SDK (monnify.js) using apiKey + contract_code.
  * Webhook signature header is `monnify-signature` (SHA-512), and Monnify does
    NOT send it in sandbox.
"""
import base64
import hashlib
import hmac
import logging
from decimal import Decimal

import requests
from django.core.cache import cache

from .base import PaymentProvider, PaymentInitResult, PaymentVerifyResult

logger = logging.getLogger(__name__)

SANDBOX_BASE = "https://sandbox.monnify.com"
LIVE_BASE = "https://api.monnify.com"


class MonnifyProvider(PaymentProvider):
    def __init__(self, config: dict | None = None):
        config = config or {}
        self.api_key = config.get('client_key', '')       # Monnify API key (client-safe)
        self.secret_key = config.get('secret_key', '')
        self.contract_code = config.get('contract_code', '')
        self.mode = (config.get('mode') or 'TEST').upper()
        self.gateway_id = config.get('gateway_id', 'env')
        self.base = SANDBOX_BASE if self.mode == 'TEST' else LIVE_BASE

    # ── Auth ──────────────────────────────────────────────────────────────────
    def _access_token(self) -> str:
        cache_key = f"monnify:{self.gateway_id}:access_token"
        token = cache.get(cache_key)
        if token:
            return token
        basic = base64.b64encode(f"{self.api_key}:{self.secret_key}".encode()).decode()
        resp = requests.post(
            f"{self.base}/api/v1/auth/login",
            headers={"Authorization": f"Basic {basic}", "Content-Type": "application/json"},
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json().get("responseBody", {})
        token = body.get("accessToken", "")
        expires_in = int(body.get("expiresIn", 3600) or 3600)
        cache.set(cache_key, token, timeout=max(60, expires_in - 300))  # refresh a little early
        return token

    def _auth_headers(self) -> dict:
        return {"Authorization": f"Bearer {self._access_token()}", "Content-Type": "application/json"}

    # ── Interface ───────────────────────────────────────────────────────────────
    def public_config(self) -> dict:
        return {
            "apiKey": self.api_key,
            "contractCode": self.contract_code,
            "isTestMode": self.mode == 'TEST',
        }

    def initialize(self, *, amount_kobo: int, email: str, reference: str, metadata: dict) -> PaymentInitResult:
        # Inline-SDK flow: the client SDK creates the transaction using `reference`
        # as the Monnify paymentReference. No server call needed here; the endpoint
        # returns public_config for the SDK, and we verify by paymentReference.
        return PaymentInitResult(
            reference=reference,
            provider="MONNIFY",
            provider_reference=reference,
            public_config=self.public_config(),
        )

    def verify(self, *, reference: str) -> PaymentVerifyResult:
        resp = requests.get(
            f"{self.base}/api/v1/merchant/transactions/query",
            params={"paymentReference": reference},
            headers=self._auth_headers(),
            timeout=30,
        )
        resp.raise_for_status()
        body = resp.json().get("responseBody", {})
        pay_status = (body.get("paymentStatus") or "").upper()
        if pay_status == 'PAID':
            status = 'success'
        elif pay_status in ('FAILED', 'EXPIRED', 'REVERSED'):
            status = 'failed'
        else:
            status = 'abandoned'   # PENDING / unknown — not yet settled
        amount_paid = body.get("amountPaid") or 0
        amount_kobo = int((Decimal(str(amount_paid)) * 100).to_integral_value())
        return PaymentVerifyResult(
            reference=reference,
            status=status,
            amount_kobo=amount_kobo,
            currency=body.get("currencyCode", "NGN"),
            metadata=body,
            provider_txn_ref=body.get("transactionReference", ""),
        )

    def verify_webhook(self, *, payload: bytes, signature: str) -> bool:
        if not signature:
            # Monnify omits the signature in sandbox; accept only in TEST mode.
            return self.mode == 'TEST'
        secret = (self.secret_key or '').encode()
        # Monnify's docs describe the signature two ways across pages; accept
        # either the HMAC-SHA512 form (SDK sample) or the SHA-512(secret+body)
        # concatenation form. Both are constant-time compared.
        hmac_hex = hmac.new(secret, payload, hashlib.sha512).hexdigest()
        concat_hex = hashlib.sha512(secret + payload).hexdigest()
        return hmac.compare_digest(hmac_hex, signature) or hmac.compare_digest(concat_hex, signature)

    def parse_webhook(self, payload: dict) -> dict:
        data = payload.get("eventData") or {}
        return {
            "event_type": payload.get("eventType", ""),
            "reference": data.get("paymentReference", ""),
        }
