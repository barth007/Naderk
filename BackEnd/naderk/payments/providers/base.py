from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class PaymentInitResult:
    reference: str
    authorization_url: str
    access_code: str


@dataclass
class PaymentVerifyResult:
    reference: str
    status: str          # 'success' | 'failed' | 'abandoned'
    amount_kobo: int
    currency: str
    metadata: dict = field(default_factory=dict)


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
