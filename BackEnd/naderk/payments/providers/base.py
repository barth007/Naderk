from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class PaymentInitResult:
    reference: str
    # Redirect-based providers (Paystack) return an authorization_url/access_code;
    # SDK-based providers (Monnify) return a public_config for the client SDK.
    authorization_url: str = ''
    access_code: str = ''
    provider: str = ''
    provider_reference: str | None = None
    public_config: dict = field(default_factory=dict)


@dataclass
class PaymentVerifyResult:
    reference: str
    status: str          # 'success' | 'failed' | 'abandoned'
    amount_kobo: int
    currency: str
    metadata: dict = field(default_factory=dict)
    provider_txn_ref: str = ''


class PaymentProvider(ABC):
    @abstractmethod
    def initialize(
        self,
        *,
        amount_kobo: int,
        email: str,
        reference: str,
        metadata: dict,
    ) -> PaymentInitResult: ...

    @abstractmethod
    def verify(self, *, reference: str) -> PaymentVerifyResult: ...

    @abstractmethod
    def verify_webhook(self, *, payload: bytes, signature: str) -> bool: ...

    def public_config(self) -> dict:
        """Client-safe config handed to the frontend/SDK (never secrets)."""
        return {}

    def parse_webhook(self, payload: dict) -> dict:
        """
        Extract provider-neutral fields from a webhook body:
        {'event_type': str, 'reference': str}. `reference` is OUR payment
        reference (the provider's paymentReference), used to locate the txn.
        """
        return {'event_type': '', 'reference': ''}
