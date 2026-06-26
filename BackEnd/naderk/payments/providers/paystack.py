import hashlib
import hmac

import requests
from django.conf import settings

from .base import PaymentInitResult, PaymentVerifyResult, PaymentProvider


PAYSTACK_BASE = "https://api.paystack.co"


class PaystackProvider(PaymentProvider):
    def __init__(self):
        self.secret_key = getattr(settings, "PAYSTACK_SECRET_KEY", "")
        self.webhook_secret = getattr(settings, "PAYSTACK_WEBHOOK_SECRET", "") or self.secret_key
        self._headers = {
            "Authorization": f"Bearer {self.secret_key}",
            "Content-Type": "application/json",
        }

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
