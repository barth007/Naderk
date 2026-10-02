"""The admin billing page: totals, the transaction list, and gateway management."""
from datetime import timedelta

import pytest
from django.utils import timezone

from naderk.appointments.tests import factories as appointments
from naderk.core.models import User
from naderk.ecommerce.models import Order
from naderk.payments.models import PaymentGateway, PaymentTransaction
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

SUMMARY = '/api/v1/payments/admin/summary/'
TRANSACTIONS = '/api/v1/payments/admin/transactions/'
GATEWAYS = '/api/v1/payments/admin/gateways/'
T = PaymentTransaction.Status


@pytest.fixture
def books(patient, doctor):
    """Two paid appointments, one paid order, one failed, one pending, one long-overdue."""
    appt = appointments.appointment(patient, appointments.service(), doctor)
    order = Order.objects.create(user=patient, total_price='300.00', shipping_address='x')
    made = {}
    for ref, amount, status, link in [
        ('A1', 850_000, T.SUCCESS, {'appointment': appt}), ('A2', 150_000, T.SUCCESS, {'appointment': appt}),
        ('O1', 30_000, T.SUCCESS, {'order': order}), ('F1', 99, T.FAILED, {'order': order}),
        ('X1', 77, T.ABANDONED, {}), ('P1', 500, T.INITIATED, {}), ('P2', 4_000, T.INITIATED, {}),
    ]:
        made[ref] = PaymentTransaction.objects.create(
            user=patient, provider='PAYSTACK', reference=ref, amount_kobo=amount, status=status,
            raw_response={}, **link)
    PaymentTransaction.objects.filter(reference='P2').update(created_at=timezone.now() - timedelta(days=3))
    return made


def test_summary_totals(admin_user, books):
    data = client_for(admin_user).get(SUMMARY).json()['data']

    assert data == {
        'total_revenue_kobo': 1_030_000, 'appointment_revenue_kobo': 1_000_000, 'order_revenue_kobo': 30_000,
        'pending_count': 2, 'failed_count': 2, 'overdue_invoice_amount_kobo': 4_000,
    }


def test_summary_with_no_transactions_is_all_zeros(admin_user):
    assert set(client_for(admin_user).get(SUMMARY).json()['data'].values()) == {0}


def test_summary_date_filter(admin_user, books):
    today = timezone.now().date()

    recent = client_for(admin_user).get(SUMMARY, {'date_from': today.isoformat()}).json()['data']
    older = client_for(admin_user).get(SUMMARY, {'date_to': (today - timedelta(days=1)).isoformat()}).json()['data']

    assert (recent['pending_count'], recent['total_revenue_kobo']) == (1, 1_030_000)
    assert (older['pending_count'], older['total_revenue_kobo']) == (1, 0)


def refs(response):
    return {row['reference'] for row in response.json()['data']['results']}


def test_transaction_list_filters(admin_user, books):
    client = client_for(admin_user)

    assert refs(client.get(TRANSACTIONS, {'page_size': 50})) == set(books)
    assert refs(client.get(TRANSACTIONS, {'type': 'appointment'})) == {'A1', 'A2'}
    assert refs(client.get(TRANSACTIONS, {'type': 'order'})) == {'O1', 'F1'}
    assert refs(client.get(TRANSACTIONS, {'status': 'success'})) == {'A1', 'A2', 'O1'}
    assert refs(client.get(TRANSACTIONS, {'type': 'order', 'status': 'FAILED'})) == {'F1'}


def test_transaction_rows_describe_what_was_paid_for(admin_user, patient, books):
    rows = {row['reference']: row for row in
            client_for(admin_user).get(TRANSACTIONS, {'page_size': 50}).json()['data']['results']}

    assert (rows['A1']['type'], rows['A1']['service_description']) == ('APPOINTMENT', 'Consult')
    assert rows['O1']['type'] == 'ORDER' and rows['O1']['service_description'].startswith('Marketplace Order #')
    assert rows['P1']['type'] == 'OTHER'
    assert rows['A1']['patient_email'] == patient.email


def test_transaction_list_pages(admin_user, books):
    client = client_for(admin_user)

    first = client.get(TRANSACTIONS, {'page_size': 3}).json()['data']
    last = client.get(TRANSACTIONS, {'page_size': 3, 'page': 3}).json()['data']
    garbage = client.get(TRANSACTIONS, {'page_size': 'lots', 'page': 'first'}).json()['data']

    assert (first['count'], first['total_pages'], len(first['results'])) == (7, 3, 3)
    assert len(last['results']) == 1
    assert (garbage['page'], garbage['page_size']) == (1, 10)


@pytest.mark.parametrize('role', [User.Role.PATIENT, User.Role.DOCTOR, User.Role.MEDICAL_AGENT, User.Role.OPERATIONS_MANAGER])
def test_billing_is_admin_only(role):
    client = client_for(make_user('x@naderk.test', role=role))

    assert client.get(SUMMARY).status_code == 403
    assert client.get(TRANSACTIONS).status_code == 403
    assert client.get(GATEWAYS).status_code == 403


# ── Gateways ─────────────────────────────────────────────────────────────────

def test_gateway_lifecycle(admin_user):
    client = client_for(admin_user)

    created = client.post(GATEWAYS, {'provider': 'paystack', 'mode': 'live', 'client_key': 'pk_live',
                                     'secret_key': 'sk_live_1234567890'}, format='json')
    assert created.status_code == 201, created.content
    data = created.json()['data']
    assert (data['provider'], data['mode'], data['secret_key_hint']) == ('PAYSTACK', 'LIVE', '••••7890')
    assert 'sk_live_1234567890' not in created.content.decode()

    pk = data['id']
    patched = client.patch(f'{GATEWAYS}{pk}/', {'is_active': True, 'display_name': 'Cards'}, format='json')
    assert patched.status_code == 200
    gateway = PaymentGateway.objects.get(pk=pk)
    assert (gateway.is_active, gateway.display_name, gateway.get_secret_key()) == (True, 'Cards', 'sk_live_1234567890')

    assert client.delete(f'{GATEWAYS}{pk}/').status_code == 200
    assert not PaymentGateway.objects.exists()


def test_gateway_validation(admin_user):
    client = client_for(admin_user)
    client.post(GATEWAYS, {'provider': 'PAYSTACK', 'mode': 'TEST'}, format='json')

    assert client.post(GATEWAYS, {'provider': 'PAYSTACK', 'mode': 'TEST'}, format='json').status_code == 409
    assert client.post(GATEWAYS, {'provider': 'BITCOIN'}, format='json').status_code == 400
    assert client.post(GATEWAYS, {'provider': 'MONNIFY', 'mode': 'STAGING'}, format='json').status_code == 400
    missing = f'{GATEWAYS}00000000-0000-0000-0000-000000000000/'
    assert client.patch(missing, {}, format='json').status_code == 404
    assert client.delete(missing).status_code == 404


def test_checkout_sees_only_active_gateways_and_only_public_keys(admin_user, patient):
    for provider, active in [('PAYSTACK', True), ('MONNIFY', False)]:
        gateway = PaymentGateway(provider=provider, mode='TEST', display_name=provider.title(),
                                 is_active=active, client_key=f'pub_{provider}', contract_code='999')
        gateway.set_secret_key('very-secret')
        gateway.save()

    res = client_for(patient).get('/api/v1/payments/gateways/')

    assert [g['provider'] for g in res.json()['data']] == ['PAYSTACK']
    assert res.json()['data'][0]['public_config'] == {'public_key': 'pub_PAYSTACK'}
    assert 'very-secret' not in res.content.decode()
