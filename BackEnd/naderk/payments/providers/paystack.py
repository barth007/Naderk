import hashlib
import hmac

import requests
from django.conf import settings

from .base import PaymentInitResult, PaymentVerifyResult, PaymentProvider


PAYSTACK_BASE = "https://api.paystack.co"


class PaystackProvider(PaymentProvider):
    def __init__(self, config: dict | None = None):
        config = config or {}
        self.secret_key = config.get("secret_key") or getattr(settings, "PAYSTACK_SECRET_KEY", "")
        self.client_key = config.get("client_key") or getattr(settings, "PAYSTACK_PUBLIC_KEY", "")
        self.webhook_secret = (
            config.get("webhook_secret")
            or getattr(settings, "PAYSTACK_WEBHOOK_SECRET", "")
            or self.secret_key
        )
        self._headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

    def public_config(self) -> dict:
        return {"public_key": self.client_key}

    def initialize(self, *, amount_kobo: int, email: str, reference: str, metadata: dict) -> PaymentInitResult:
        payload = {
            "amount": amount_kobo,
            "email": email,
            "reference": reference,
            "metadata": metadata,
            "currency": "NGN",
        }
        resp = requests.post(f"{PAYSTACK_BASE}/transaction/initialize", json=payload, headers=self._headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()["data"]
        return PaymentInitResult(
            reference=reference,
            authorization_url=data["authorization_url"],
            access_code=data["access_code"],
            provider="PAYSTACK",
            provider_reference=data.get("reference", reference),
            public_config=self.public_config(),
        )

    def verify(self, *, reference: str) -> PaymentVerifyResult:
        resp = requests.get(f"{PAYSTACK_BASE}/transaction/verify/{reference}", headers=self._headers, timeout=30)
        resp.raise_for_status()
        data = resp.json()["data"]
        return PaymentVerifyResult(
            reference=reference,
            status=data["status"],          # 'success', 'failed', 'abandoned', etc.
            amount_kobo=data["amount"],
            currency=data.get("currency", "NGN"),
            metadata=data,
        )

    def verify_webhook(self, *, payload: bytes, signature: str) -> bool:
        expected = hmac.new(self.webhook_secret.encode(), payload, hashlib.sha512).hexdigest()
        return hmac.compare_digest(expected, signature)

    def parse_webhook(self, payload: dict) -> dict:
        return {
            'event_type': payload.get('event', ''),
            'reference': (payload.get('data') or {}).get('reference', ''),
        }
