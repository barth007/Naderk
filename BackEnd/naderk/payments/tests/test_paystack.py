"""The Paystack adapter, and the webhook endpoints of both providers."""
import hashlib
import hmac
import json
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
import requests

from naderk.appointments.models import Appointment
from naderk.appointments.tests import factories
from naderk.payments.crypto import decrypt_secret, encrypt_secret
from naderk.payments.models import PaymentGateway, PaymentTransaction, PaymentWebhookEvent
from naderk.payments.providers.paystack import PaystackProvider
from naderk.payments.services import get_provider

pytestmark = pytest.mark.django_db

CONFIG = {'secret_key': 'sk_test_abc', 'client_key': 'pk_test_abc'}


def response(data, status=200):
    res = Mock(status_code=status)
    res.json.return_value = {'status': True, 'data': data}
    res.raise_for_status.side_effect = None if status < 400 else requests.HTTPError(f'{status}')
    return res


# ── Adapter ──────────────────────────────────────────────────────────────────

def test_initialize_sends_kobo_and_our_reference():
    reply = response({'authorization_url': 'https://paystack.test/pay/x', 'access_code': 'AC', 'reference': 'NDK-1'})

    with patch('naderk.payments.providers.paystack.requests.post', return_value=reply) as post:
        result = PaystackProvider(CONFIG).initialize(
            amount_kobo=850_000, email='p@naderk.test', reference='NDK-1', metadata={'appointment_id': 'a'})

    sent = post.call_args.kwargs
    assert post.call_args.args[0] == 'https://api.paystack.co/transaction/initialize'
    assert sent['json'] == {'amount': 850_000, 'email': 'p@naderk.test', 'reference': 'NDK-1',
                            'metadata': {'appointment_id': 'a'}, 'currency': 'NGN'}
    assert sent['headers']['Authorization'] == 'Bearer sk_test_abc'
    assert (result.reference, result.access_code, result.authorization_url) == ('NDK-1', 'AC', 'https://paystack.test/pay/x')
    assert result.public_config == {'public_key': 'pk_test_abc'}


def test_verify_reports_status_amount_and_currency():
    reply = response({'status': 'success', 'amount': 850_000, 'currency': 'NGN', 'id': 99})

    with patch('naderk.payments.providers.paystack.requests.get', return_value=reply) as get:
        result = PaystackProvider(CONFIG).verify(reference='NDK-1')

    assert get.call_args.args[0] == 'https://api.paystack.co/transaction/verify/NDK-1'
    assert (result.status, result.amount_kobo, result.currency) == ('success', 850_000, 'NGN')
    assert result.metadata['id'] == 99


def test_http_errors_are_raised_not_swallowed():
    with patch('naderk.payments.providers.paystack.requests.get', return_value=response({}, status=401)):
        with pytest.raises(requests.HTTPError):
            PaystackProvider(CONFIG).verify(reference='NDK-1')


def signed(body: bytes, secret='sk_test_abc'):
    return hmac.new(secret.encode(), body, hashlib.sha512).hexdigest()


def test_webhook_signature_uses_the_secret_key_unless_a_webhook_secret_is_set():
    body = b'{"event":"charge.success"}'
    default = PaystackProvider(CONFIG)
    custom = PaystackProvider({**CONFIG, 'webhook_secret': 'whsec'})

    assert default.verify_webhook(payload=body, signature=signed(body)) is True
    assert default.verify_webhook(payload=body + b' ', signature=signed(body)) is False
    assert default.verify_webhook(payload=body, signature='') is False
    assert custom.verify_webhook(payload=body, signature=signed(body, 'whsec')) is True
    assert custom.verify_webhook(payload=body, signature=signed(body)) is False


def test_parse_webhook_tolerates_missing_fields():
    provider = PaystackProvider(CONFIG)

    assert provider.parse_webhook({'event': 'charge.success', 'data': {'reference': 'NDK-1'}}) == {
        'event_type': 'charge.success', 'reference': 'NDK-1'}
    assert provider.parse_webhook({}) == {'event_type': '', 'reference': ''}
    assert provider.parse_webhook({'data': None}) == {'event_type': '', 'reference': ''}


def test_database_gateway_takes_precedence_over_environment_keys(settings):
    settings.PAYSTACK_SECRET_KEY = 'sk_env'
    assert get_provider('PAYSTACK').secret_key == 'sk_env'

    gateway = PaymentGateway(provider='PAYSTACK', mode='TEST', display_name='Paystack', is_active=True,
                             client_key='pk_db')
    gateway.set_secret_key('sk_db')
    gateway.save()

    provider = get_provider('paystack')
    assert (provider.secret_key, provider.client_key) == ('sk_db', 'pk_db')


def test_unknown_provider_name():
    with pytest.raises(ValueError, match='Unknown payment provider'):
        get_provider('BITCOIN')


# ── Stored secrets ───────────────────────────────────────────────────────────

def test_secret_round_trip_and_never_stored_in_the_clear():
    token = encrypt_secret('sk_live_very_secret')

    assert 'sk_live' not in token
    assert decrypt_secret(token) == 'sk_live_very_secret'
    assert (encrypt_secret(''), decrypt_secret('')) == ('', '')


def test_a_secret_encrypted_under_another_key_reads_as_empty_not_as_an_error(settings):
    settings.PAYMENT_ENCRYPTION_KEY = 'first-key'
    token = encrypt_secret('sk_live_very_secret')

    settings.PAYMENT_ENCRYPTION_KEY = 'rotated-key'

    assert decrypt_secret(token) == ''
    assert decrypt_secret('not-a-token') == ''


# ── Webhook endpoints ────────────────────────────────────────────────────────

PAYSTACK_HOOK = '/api/v1/payments/webhook/paystack/'
MONNIFY_HOOK = '/api/v1/payments/webhook/monnify/'


@pytest.fixture
def paystack_keys(settings):
    settings.PAYSTACK_SECRET_KEY = 'sk_test_abc'
    settings.PAYSTACK_WEBHOOK_SECRET = ''


@pytest.fixture
def pending_payment(patient, doctor):
    appt = factories.appointment(patient, factories.service(fee='8500.00'), doctor)
    txn = PaymentTransaction.objects.create(
        user=patient, provider='PAYSTACK', reference='NDK-HOOK1', amount_kobo=850_000,
        appointment=appt, raw_response={})
    return appt, txn


def paystack_says(status='success', amount=850_000):
    return patch('naderk.payments.providers.paystack.PaystackProvider.verify',
                 return_value=SimpleNamespace(reference='NDK-HOOK1', status=status, amount_kobo=amount,
                                              currency='NGN', metadata={}, provider_txn_ref=''))


def deliver(client, body, signature=None):
    raw = json.dumps(body).encode()
    return client.post(PAYSTACK_HOOK, raw, content_type='application/json',
                       HTTP_X_PAYSTACK_SIGNATURE=signed(raw) if signature is None else signature)


def test_a_signed_webhook_confirms_the_payment(client, paystack_keys, pending_payment):
    appt, txn = pending_payment

    with paystack_says():
        res = deliver(client, {'event': 'charge.success', 'data': {'reference': 'NDK-HOOK1'}})

    assert res.status_code == 200
    appt.refresh_from_db()
    txn.refresh_from_db()
    assert (appt.payment_status, txn.status) == (Appointment.PaymentStatus.PAID, 'SUCCESS')
    event = PaymentWebhookEvent.objects.get()
    assert (event.processing_status, event.payment_reference, event.signature_valid) == ('PROCESSED', 'NDK-HOOK1', True)


def test_the_webhook_body_is_never_trusted_on_its_own(client, paystack_keys, pending_payment):
    """A correctly signed 'success' still has to be confirmed by asking Paystack."""
    appt, _ = pending_payment

    with paystack_says(status='failed', amount=0):
        deliver(client, {'event': 'charge.success', 'data': {'reference': 'NDK-HOOK1', 'amount': 850_000}})

    appt.refresh_from_db()
    assert appt.payment_status == Appointment.PaymentStatus.PENDING


def test_an_unsigned_or_wrongly_signed_webhook_is_refused_and_not_recorded(client, paystack_keys, pending_payment):
    appt, _ = pending_payment
    body = {'event': 'charge.success', 'data': {'reference': 'NDK-HOOK1'}}

    with paystack_says():
        assert deliver(client, body, signature='').status_code == 400
        assert deliver(client, body, signature='deadbeef').status_code == 400

    appt.refresh_from_db()
    assert appt.payment_status == Appointment.PaymentStatus.PENDING
    assert not PaymentWebhookEvent.objects.exists()


def test_a_repeated_delivery_is_processed_once(client, paystack_keys, pending_payment):
    body = {'event': 'charge.success', 'data': {'reference': 'NDK-HOOK1'}}

    with paystack_says() as verify:
        first, second = deliver(client, body), deliver(client, body)

    assert (first.status_code, second.status_code) == (200, 200)
    assert PaymentWebhookEvent.objects.count() == 1
    assert verify.call_count == 1


def test_a_webhook_for_an_unknown_reference_is_acknowledged(client, paystack_keys):
    with paystack_says():
        res = deliver(client, {'event': 'charge.success', 'data': {'reference': 'NDK-NOPE'}})

    assert res.status_code == 200
    assert PaymentWebhookEvent.objects.get().processing_status == 'PROCESSED'


def test_a_webhook_without_a_reference_is_ignored(client, paystack_keys):
    deliver(client, {'event': 'transfer.success', 'data': {}})

    assert PaymentWebhookEvent.objects.get().processing_status == 'IGNORED'


def monnify_gateway(mode):
    gateway = PaymentGateway(provider='MONNIFY', mode=mode, display_name='Monnify', is_active=True,
                             client_key='MK_TEST', contract_code='123')
    gateway.set_secret_key('monnify-secret')
    gateway.save()


def test_monnify_live_mode_requires_a_signature(client):
    monnify_gateway('LIVE')
    raw = json.dumps({'eventType': 'SUCCESSFUL_TRANSACTION', 'eventData': {'paymentReference': 'NDK-M1'}})

    unsigned = client.post(MONNIFY_HOOK, raw, content_type='application/json')
    good = hmac.new(b'monnify-secret', raw.encode(), hashlib.sha512).hexdigest()
    with patch('naderk.payments.services.confirm_and_fulfill'):
        signed_call = client.post(MONNIFY_HOOK, raw, content_type='application/json', HTTP_MONNIFY_SIGNATURE=good)

    assert (unsigned.status_code, signed_call.status_code) == (400, 200)
    assert PaymentWebhookEvent.objects.get().payment_reference == 'NDK-M1'


def test_monnify_sandbox_tolerates_a_missing_signature_and_says_so(client):
    monnify_gateway('TEST')
    raw = json.dumps({'eventType': 'SUCCESSFUL_TRANSACTION', 'eventData': {'paymentReference': 'NDK-M1'}})

    with patch('naderk.payments.services.confirm_and_fulfill'):
        res = client.post(MONNIFY_HOOK, raw, content_type='application/json')

    assert res.status_code == 200
    assert PaymentWebhookEvent.objects.get().signature_valid is False
