"""Starting a payment for a booked appointment."""
from unittest.mock import patch

import pytest

from naderk.appointments.tests import factories
from naderk.payments.models import PaymentTransaction
from naderk.payments.providers.base import PaymentInitResult
from tests.helpers import client_for

pytestmark = pytest.mark.django_db

INITIALIZE = '/api/v1/payments/initialize-appointment/'


class FakeProvider:
    def __init__(self):
        self.charged = []

    def initialize(self, *, amount_kobo, email, reference, metadata):
        self.charged.append((amount_kobo, email, metadata))
        return PaymentInitResult(reference=reference, access_code='AC-1', provider='PAYSTACK',
                                 public_config={'public_key': 'pk_test'})

    def public_config(self):
        return {'public_key': 'pk_test'}


@pytest.fixture
def provider():
    fake = FakeProvider()
    with patch('naderk.payments.services.get_provider', return_value=fake):
        yield fake


def start(user, appt, key=None, **body):
    headers = {'HTTP_IDEMPOTENCY_KEY': key} if key else {}
    return client_for(user).post(INITIALIZE, {'appointment_id': str(appt.id), **body}, format='json', **headers)


def test_the_amount_is_the_appointments_fee_whatever_the_client_sends(patient, doctor, provider):
    appt = factories.appointment(patient, factories.service(fee='8500.00'), doctor)

    res = start(patient, appt, amount_kobo=1)

    assert res.status_code == 200, res.content
    amount, email, metadata = provider.charged[0]
    assert (amount, email) == (850_000, patient.email)
    assert metadata['appointment_id'] == str(appt.id)
    txn = PaymentTransaction.objects.get()
    assert (txn.amount_kobo, txn.appointment, txn.status) == (850_000, appt, 'INITIATED')
    data = res.json()['data']
    assert data['reference'] == txn.reference and data['reference'].startswith('NDK-')
    assert data['public_key'] == 'pk_test'


def test_each_attempt_gets_its_own_reference(patient, doctor, provider):
    appt = factories.appointment(patient, factories.service(), doctor)

    first, second = start(patient, appt).json()['data'], start(patient, appt).json()['data']

    assert first['reference'] != second['reference']


def test_the_same_idempotency_key_returns_the_same_payment(patient, doctor, provider):
    appt = factories.appointment(patient, factories.service(), doctor)

    first = start(patient, appt, key='appt-abc').json()['data']
    second = start(patient, appt, key='appt-abc').json()['data']

    assert first['reference'] == second['reference']
    assert second['access_code'] == 'AC-1'
    assert PaymentTransaction.objects.count() == 1
    assert len(provider.charged) == 1


def test_an_idempotency_key_is_private_to_its_user(patient, other_patient, doctor, provider):
    mine = factories.appointment(patient, factories.service(), doctor)
    theirs = factories.appointment(other_patient, factories.service('other'), doctor)
    first = start(patient, mine, key='shared-key').json()['data']

    res = start(other_patient, theirs, key='shared-key')

    # The key is unique in the database, so the second user's attempt cannot reuse it —
    # and must not be handed the first user's payment.
    assert res.status_code != 200 or res.json()['data']['reference'] != first['reference']


def test_refusals(patient, other_patient, doctor, provider, api_client):
    paid = factories.appointment(patient, factories.service('a'), doctor, paid=True)
    free = factories.appointment(patient, factories.service('b', fee='0.00'), doctor)
    unpaid = factories.appointment(patient, factories.service('c'), doctor)

    assert api_client.post(INITIALIZE, {}, format='json').status_code == 401
    assert client_for(patient).post(INITIALIZE, {}, format='json').status_code == 400
    assert start(patient, paid).status_code == 409
    assert start(patient, free).status_code == 400
    assert start(other_patient, unpaid).status_code == 404
    assert provider.charged == []
    assert not PaymentTransaction.objects.exists()


def test_unknown_provider_is_refused(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor)

    res = start(patient, appt, provider='BITCOIN')

    assert res.status_code == 400
    assert not PaymentTransaction.objects.exists()


def test_provider_outage_is_reported_and_leaves_no_transaction(patient, doctor):
    appt = factories.appointment(patient, factories.service(), doctor)

    with patch('naderk.payments.services.get_provider') as get_provider:
        get_provider.return_value.initialize.side_effect = RuntimeError('timeout')
        res = start(patient, appt)

    assert res.status_code == 502
    assert not PaymentTransaction.objects.exists()
