"""
Symmetric encryption for stored payment-gateway secret keys.

Uses Fernet with settings.PAYMENT_ENCRYPTION_KEY. If that isn't set, a key is
derived from settings.SECRET_KEY so development works out of the box — but
production MUST set PAYMENT_ENCRYPTION_KEY explicitly, otherwise rotating
SECRET_KEY would make previously stored secrets undecryptable.
"""
import base64
import hashlib
import logging

from django.conf import settings
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)


def _fernet() -> Fernet:
    key = getattr(settings, 'PAYMENT_ENCRYPTION_KEY', '') or ''
    if key:
        try:
            # A properly generated Fernet key (44-char urlsafe base64) works directly.
            return Fernet(key.encode() if isinstance(key, str) else key)
        except Exception:
            # Any other string: derive a valid Fernet key from it.
            return Fernet(base64.urlsafe_b64encode(hashlib.sha256(key.encode()).digest()))
    logger.warning(
        "PAYMENT_ENCRYPTION_KEY is not set; deriving the payment-secret key from "
        "SECRET_KEY. Set PAYMENT_ENCRYPTION_KEY explicitly in production."
    )
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode()).digest()))


def encrypt_secret(plaintext: str) -> str:
    if not plaintext:
        return ''
    return _fernet().encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str) -> str:
    if not ciphertext:
        return ''
    try:
        return _fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, ValueError):
        logger.error("Failed to decrypt a stored payment secret (encryption key mismatch?).")
        return ''
