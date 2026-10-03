"""Giving to Extend Life Africa: starting a gift, paying for it, and the yearly reminder."""
import datetime
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.core import mail
from django.utils import timezone

from naderk.cms.models import PageSection
from naderk.donations.models import Donation
from naderk.donations.services import send_due_reminders
from naderk.payments.models import PaymentTransaction
from naderk.payments.providers.base import PaymentInitResult
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

DONATE = '/api/v1/donations/'
VERIFY = '/api/v1/donations/verify/'


class FakeProvider:
    def __init__(self):
        self.calls = []

    def initialize(self, *, amount_kobo, email, reference, metadata, currency='NGN'):
        self.calls.append({'amount': amount_kobo, 'email': email, 'currency': currency, 'metadata': metadata})
        return PaymentInitResult(reference=reference, access_code='AC-1', provider='PAYSTACK',
                                 public_config={'public_key': 'pk_test'})

    def public_config(self):
        return {'public_key': 'pk_test'}

    def parse_webhook(self, payload):
        return {'event_type': payload.get('event', ''), 'reference': (payload.get('data') or {}).get('reference', '')}


@pytest.fixture
def provider():
    fake = FakeProvider()
    with patch('naderk.payments.services.get_provider', return_value=fake):
        yield fake


def give(client, **body):
    body = {'donor_name': 'Ada Obi', 'donor_email': 'Ada@Example.org', 'amount': '20000', **body}
    return client.post(DONATE, body, format='json')


def provider_says(status='success', amount=None, currency='NGN'):
    def verify(reference, provider_name=None):
        txn = PaymentTransaction.objects.get(reference=reference)
        return SimpleNamespace(status=status, amount_kobo=txn.amount_kobo if amount is None else amount,
                               currency=currency, metadata={}, provider_txn_ref='')
    return patch('naderk.payments.services.verify_and_confirm', side_effect=verify)


# ── Starting a gift ──────────────────────────────────────────────────────────

def test_a_guest_starts_a_gift_without_an_account(api_client, provider):
    res = give(api_client, dedicated_to='Mum', message='For her checkup')

    assert res.status_code == 201, res.content
    donation = Donation.objects.get()
    assert (donation.user, donation.donor_email, donation.status) == (None, 'ada@example.org', 'PENDING')
    assert (donation.dedicated_to, donation.message) == ('Mum', 'For her checkup')
    data = res.json()['data']
    assert (data['amount_minor'], data['currency'], data['public_key']) == (2_000_000, 'NGN', 'pk_test')
    txn = PaymentTransaction.objects.get()
    assert (txn.user, txn.donation, txn.amount_kobo, txn.currency) == (None, donation, 2_000_000, 'NGN')
    assert provider.calls[0]['metadata']['donation_id'] == str(donation.id)


def test_a_signed_in_donors_details_fill_the_blanks(patient, provider):
    res = client_for(patient).post(DONATE, {'amount': '5000'}, format='json')

    assert res.status_code == 201, res.content
    donation = Donation.objects.get()
    assert (donation.user, donation.donor_email, donation.donor_name) == (patient, patient.email, 'Patient Test')


@pytest.mark.parametrize('currency, amount, minor', [('GBP', '10', 1000), ('USD', '6.50', 650)])
def test_pounds_and_dollars_are_charged_in_their_own_currency(api_client, provider, currency, amount, minor):
    give(api_client, currency=currency, amount=amount)

    assert provider.calls[0]['currency'] == currency
    assert provider.calls[0]['amount'] == minor
    assert PaymentTransaction.objects.get().currency == currency


@pytest.mark.parametrize('amount, purpose', [
    ('20000', 'INTERVENTION'), ('45000', 'INTERVENTION'), ('9999', 'TEST'), ('15000', 'TEST'), ('500', 'GENERAL'),
])
def test_the_gift_is_labelled_by_what_it_pays_for(api_client, provider, amount, purpose):
    give(api_client, amount=amount)

    assert Donation.objects.get().purpose == purpose


def test_prices_follow_the_cms(api_client, provider):
    PageSection.objects.create(page='extend_life_africa', section_key='giving',
                               content={'test_price_ngn': '15,000', 'intervention_price_ngn': 'not a number'})

    give(api_client, amount='12000')                 # below the new test price
    give(api_client, amount='20000')                 # the unreadable price falls back to ₦20,000

    assert list(Donation.objects.order_by('created_at').values_list('purpose', flat=True)) == ['GENERAL', 'INTERVENTION']


@pytest.mark.parametrize('body, field', [
    ({'donor_name': ''}, 'donor_name'),
    ({'donor_email': ''}, 'donor_email'),
    ({'donor_email': 'nope'}, 'donor_email'),
    ({'amount': '50'}, 'amount'),                              # below ₦100
    ({'currency': 'GBP', 'amount': '0.50'}, 'amount'),
    ({'amount': '60000000'}, 'amount'),
    ({'currency': 'EUR'}, 'currency'),
    ({'frequency': 'MONTHLY'}, 'frequency'),
])
def test_gift_validation(api_client, provider, body, field):
    res = give(api_client, **body)

    assert res.status_code == 400
    assert field in res.json()['errors']
    assert not Donation.objects.exists() and provider.calls == []


def test_monnify_cannot_take_pounds_or_dollars(api_client):
    res = give(api_client, currency='GBP', amount='10', provider='MONNIFY')

    assert res.status_code == 400
    assert 'Naira' in res.json()['detail']
    assert not Donation.objects.exists()


def test_a_provider_outage_leaves_nothing_behind(api_client):
    with patch('naderk.payments.services.get_provider') as get_provider:
        get_provider.return_value.initialize.side_effect = RuntimeError('timeout')
        res = give(api_client)

    assert res.status_code == 502
    assert not Donation.objects.exists() and not PaymentTransaction.objects.exists()


def test_the_same_attempt_retried_returns_the_same_payment(api_client, provider):
    first = api_client.post(DONATE, {'donor_name': 'Ada', 'donor_email': 'a@x.org', 'amount': '20000'},
                            format='json', HTTP_IDEMPOTENCY_KEY='gift-1').json()['data']
    second = api_client.post(DONATE, {'donor_name': 'Ada', 'donor_email': 'a@x.org', 'amount': '20000'},
                             format='json', HTTP_IDEMPOTENCY_KEY='gift-1').json()['data']

    assert first['reference'] == second['reference']
    assert Donation.objects.count() == 1 and len(provider.calls) == 1


def test_gateway_list_is_public_for_guest_donors(api_client):
    assert api_client.get('/api/v1/payments/gateways/').status_code == 200


# ── Paying ───────────────────────────────────────────────────────────────────

def started(api_client, **body):
    return give(api_client, **body).json()['data']['reference']


def test_verified_payment_marks_the_gift_paid_and_sends_a_receipt(api_client, provider):
    reference = started(api_client)

    with provider_says():
        res = api_client.post(VERIFY, {'reference': reference}, format='json')

    assert res.status_code == 200, res.content
    assert res.json()['data']['status'] == 'PAID'
    donation = Donation.objects.get()
    assert (donation.status, donation.payment_reference) == ('PAID', reference)
    assert donation.paid_at is not None and donation.next_reminder_on is None
    receipt = mail.outbox[-1]
    assert receipt.to == ['ada@example.org']
    assert reference in receipt.body and '₦20,000' in receipt.body


def test_an_unpaid_or_short_payment_is_not_recorded(api_client, provider):
    reference = started(api_client)

    with provider_says(status='abandoned', amount=0):
        assert api_client.post(VERIFY, {'reference': reference}, format='json').json()['data']['status'] == 'PENDING'
    with provider_says(amount=100):
        assert api_client.post(VERIFY, {'reference': reference}, format='json').json()['data']['status'] == 'PENDING'
    assert mail.outbox == []


def test_paying_in_another_currency_than_asked_is_not_recorded(api_client, provider):
    reference = started(api_client, currency='GBP', amount='10')

    with provider_says(currency='NGN'):
        api_client.post(VERIFY, {'reference': reference}, format='json')

    assert Donation.objects.get().status == 'PENDING'


def test_verifying_twice_sends_one_receipt(api_client, provider):
    reference = started(api_client)

    with provider_says():
        api_client.post(VERIFY, {'reference': reference}, format='json')
        api_client.post(VERIFY, {'reference': reference}, format='json')

    assert len(mail.outbox) == 1


def test_verify_refusals(api_client, provider, patient, doctor):
    from naderk.appointments.tests import factories
    appt = factories.appointment(patient, factories.service(), doctor)
    PaymentTransaction.objects.create(user=patient, provider='PAYSTACK', reference='NDK-APPT', amount_kobo=1,
                                      appointment=appt, raw_response={})

    assert api_client.post(VERIFY, {}, format='json').status_code == 400
    assert api_client.post(VERIFY, {'reference': 'NDK-NOPE'}, format='json').status_code == 404
    # Another kind of payment cannot be looked up through the donation endpoint.
    assert api_client.post(VERIFY, {'reference': 'NDK-APPT'}, format='json').status_code == 404


def test_the_webhook_confirms_a_gift_too(api_client, provider):
    from naderk.payments.services import record_webhook_event
    import json
    reference = started(api_client)

    with provider_says():
        record_webhook_event(provider_name='PAYSTACK', signature_valid=True,
                             raw_body=json.dumps({'event': 'charge.success', 'data': {'reference': reference}}).encode())

    assert Donation.objects.get().status == 'PAID'


def test_gifts_appear_in_admin_billing(api_client, provider, admin_user):
    reference = started(api_client)
    with provider_says():
        api_client.post(VERIFY, {'reference': reference}, format='json')

    rows = client_for(admin_user).get('/api/v1/payments/admin/transactions/', {'type': 'donation'}).json()['data']['results']

    assert [(r['type'], r['patient_name'], r['patient_email']) for r in rows] == [('DONATION', 'Ada Obi', 'ada@example.org')]
    assert rows[0]['service_description'] == 'Extend Life Africa — Sponsor an intervention'


# ── Yearly reminder ──────────────────────────────────────────────────────────

def paid_gift(api_client, frequency='ANNUAL', email='ada@example.org'):
    reference = started(api_client, frequency=frequency, donor_email=email)
    with provider_says():
        api_client.post(VERIFY, {'reference': reference}, format='json')
    return Donation.objects.get(payment_reference=reference)


def test_an_annual_gift_is_reminded_a_week_before_its_anniversary_and_never_charged(api_client, provider):
    gift = paid_gift(api_client)

    paid_on = timezone.localdate(gift.paid_at)
    assert gift.next_reminder_on == paid_on.replace(year=paid_on.year + 1) - datetime.timedelta(days=7)
    assert 'Nothing will be charged automatically' in mail.outbox[-1].body
    assert len(provider.calls) == 1                         # no second charge was ever set up


def test_the_reminder_goes_once_on_the_day(api_client, provider):
    gift = paid_gift(api_client)
    mail.outbox.clear()

    assert send_due_reminders(today=gift.next_reminder_on - datetime.timedelta(days=1)) == 0
    assert send_due_reminders(today=gift.next_reminder_on) == 1
    assert send_due_reminders(today=gift.next_reminder_on + datetime.timedelta(days=30)) == 0

    assert [m.subject for m in mail.outbox] == ['A year ago, you extended a life']
    assert '/extend-life-africa#give' in mail.outbox[0].body
    gift.refresh_from_db()
    assert gift.reminder_sent_at is not None and gift.next_reminder_on is None


def test_one_time_gifts_are_never_reminded(api_client, provider):
    gift = paid_gift(api_client, frequency='ONE_TIME')

    assert send_due_reminders(today=timezone.localdate() + datetime.timedelta(days=400)) == 0
    assert gift.next_reminder_on is None


def test_giving_again_replaces_the_pending_reminder(api_client, provider):
    first = paid_gift(api_client)
    second = paid_gift(api_client)

    first.refresh_from_db()
    assert first.next_reminder_on is None and second.next_reminder_on is not None
    assert send_due_reminders(today=second.next_reminder_on) == 1


def test_an_unpaid_annual_gift_is_never_reminded(api_client, provider):
    started(api_client, frequency='ANNUAL')
    Donation.objects.update(next_reminder_on=timezone.localdate())

    assert send_due_reminders() == 0


def test_the_reminder_task_is_scheduled_daily():
    from config.celery_app import app

    entry = app.conf.beat_schedule['send-donation-reminders-daily']
    assert entry['task'] == 'naderk.donations.tasks.send_donation_reminders'
