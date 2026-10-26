"""Postmark delivery webhooks update the EmailLog and keep an event trail."""
import hashlib
import hmac
import json

import pytest

from naderk.common.email.models import EmailEvent, EmailLog

pytestmark = pytest.mark.django_db

BASE = '/api/v1/webhooks/email/postmark/'


@pytest.fixture(autouse=True)
def no_signature_required(settings):
    settings.POSTMARK_WEBHOOK_TOKEN = ''


@pytest.fixture
def log():
    return EmailLog.objects.create(
        recipient='a@naderk.test', subject='S', provider='postmark',
        provider_message_id='pm-123', status='sent',
    )


def hook(client, kind, body=None, raw=None, **headers):
    raw = raw if raw is not None else json.dumps({'MessageID': 'pm-123', **(body or {})})
    return client.post(f'{BASE}{kind}/', raw, content_type='application/json', **headers)


@pytest.mark.parametrize('kind, status, stamp', [
    ('delivery', 'delivered', 'delivered_at'),
    ('spam', 'complained', 'complained_at'),
    ('open', 'opened', 'opened_at'),
    ('click', 'clicked', 'clicked_at'),
])
def test_event_updates_status_and_timestamp(client, log, kind, status, stamp):
    res = hook(client, kind)

    assert res.status_code == 200
    log.refresh_from_db()
    assert log.status == status
    assert getattr(log, stamp) is not None
    assert list(log.events.values_list('event_type', 'provider')) == [(status, 'postmark')]


@pytest.mark.parametrize('postmark_type, expected', [
    ('HardBounce', 'hard'), ('BadEmailAddress', 'hard'), ('InvalidDomain', 'hard'),
    ('SoftBounce', 'soft'), ('Transient', 'soft'), ('', 'soft'),
])
def test_bounce_is_classified(client, log, postmark_type, expected):
    hook(client, 'bounce', {'Type': postmark_type})

    log.refresh_from_db()
    assert (log.status, log.bounce_type) == ('bounced', expected)
    assert log.bounced_at is not None


def test_an_open_after_a_click_does_not_downgrade_the_status(client, log):
    hook(client, 'click')
    hook(client, 'open')

    log.refresh_from_db()
    assert log.status == 'clicked'
    assert log.events.count() == 2


def test_first_open_time_is_kept_on_repeat_opens(client, log):
    hook(client, 'open')
    log.refresh_from_db()
    first = log.opened_at

    hook(client, 'open')

    log.refresh_from_db()
    assert log.opened_at == first


@pytest.mark.parametrize('kind', ['delivery', 'bounce', 'spam', 'open', 'click'])
def test_unknown_message_is_acknowledged_and_ignored(client, kind):
    res = hook(client, kind, raw=json.dumps({'MessageID': 'nobody'}))

    assert res.status_code == 200
    assert not EmailEvent.objects.exists()


@pytest.mark.parametrize('kind', ['delivery', 'bounce', 'spam', 'open', 'click'])
def test_malformed_json_is_rejected(client, log, kind):
    assert hook(client, kind, raw='{not json').status_code == 400


def test_secrets_in_the_payload_are_not_stored(client, log):
    hook(client, 'delivery', {'Token': 'abc', 'Recipient': 'a@naderk.test'})

    assert log.events.get().payload == {'MessageID': 'pm-123', 'Recipient': 'a@naderk.test'}


# ── Signature ────────────────────────────────────────────────────────────────

def signature(body, token='hook-secret'):
    return hmac.new(token.encode(), body.encode(), hashlib.sha256).hexdigest()


@pytest.mark.parametrize('kind', ['delivery', 'bounce', 'spam', 'open', 'click'])
def test_when_a_token_is_configured_unsigned_calls_are_refused(client, log, settings, kind):
    settings.POSTMARK_WEBHOOK_TOKEN = 'hook-secret'

    assert hook(client, kind).status_code == 401
    log.refresh_from_db()
    assert log.status == 'sent'


def test_correctly_signed_call_is_accepted(client, log, settings):
    settings.POSTMARK_WEBHOOK_TOKEN = 'hook-secret'
    body = json.dumps({'MessageID': 'pm-123'})

    res = hook(client, 'delivery', raw=body, HTTP_X_POSTMARK_SIGNATURE_256=signature(body))

    assert res.status_code == 200
    log.refresh_from_db()
    assert log.status == 'delivered'


def test_signature_from_another_secret_or_body_is_refused(client, log, settings):
    settings.POSTMARK_WEBHOOK_TOKEN = 'hook-secret'
    body = json.dumps({'MessageID': 'pm-123'})

    wrong_secret = hook(client, 'delivery', raw=body, HTTP_X_POSTMARK_SIGNATURE_256=signature(body, 'other'))
    wrong_body = hook(client, 'delivery', raw=body, HTTP_X_POSTMARK_SIGNATURE_256=signature('{}'))

    assert (wrong_secret.status_code, wrong_body.status_code) == (401, 401)
