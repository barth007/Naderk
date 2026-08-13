"""
Resolve payment-gateway credentials for a provider.

Precedence:
  1. An active PaymentGateway row for the provider (DB, decrypted).
  2. Provider-specific environment fallback (legacy settings.PAYSTACK_*).
  3. Raise ProviderNotConfigured.

Never returns another provider's credentials (a Monnify request must never get
Paystack's keys).
"""
from django.conf import settings


class ProviderNotConfigured(Exception):
    pass


def _from_db(provider: str, mode: str | None = None) -> dict | None:
    from .models import PaymentGateway
    qs = PaymentGateway.objects.filter(provider=provider, is_active=True)
    if mode:
        qs = qs.filter(mode=mode)
    gw = qs.order_by('-is_default', '-updated_at').first()
    if not gw:
        return None
    secret = gw.get_secret_key()
    return {
        'provider': gw.provider,
        'mode': gw.mode,
        'gateway_id': str(gw.id),
        'display_name': gw.display_name,
        'client_key': gw.client_key,
        'secret_key': secret,
        'contract_code': gw.contract_code,
        'config': gw.config or {},
        'webhook_secret': (gw.config or {}).get('webhook_secret') or secret,
    }


def _from_env(provider: str) -> dict | None:
    if provider == 'PAYSTACK':
        secret = getattr(settings, 'PAYSTACK_SECRET_KEY', '')
        if not secret:
            return None
        return {
            'provider': 'PAYSTACK',
            'mode': 'LIVE' if str(secret).startswith('sk_live') else 'TEST',
            'gateway_id': 'env',
            'display_name': 'Paystack',
            'client_key': getattr(settings, 'PAYSTACK_PUBLIC_KEY', ''),
            'secret_key': secret,
            'contract_code': '',
            'config': {},
            'webhook_secret': getattr(settings, 'PAYSTACK_WEBHOOK_SECRET', '') or secret,
        }
    return None


def gateway_config(provider: str, mode: str | None = None) -> dict:
    provider = (provider or '').upper()
    cfg = _from_db(provider, mode) or _from_env(provider)
    if not cfg:
        raise ProviderNotConfigured(f"No active configuration for payment provider {provider!r}.")
    return cfg
