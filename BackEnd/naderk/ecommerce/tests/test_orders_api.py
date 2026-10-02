"""Orders after checkout: who can see them, and how they move through fulfilment."""
import pytest
from django.core.exceptions import ValidationError

from naderk.core.models import User
from naderk.ecommerce.models import Order
from naderk.ecommerce.services import cart_add_item, order_create_from_cart, order_process_payment, order_update_status
from naderk.ecommerce.tests import factories
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

ORDERS = '/api/v1/marketplace/orders/'
S = Order.Status


def order_for(user, paid=True, with_prescription=False):
    if with_prescription:
        frame = factories.frame_variant()
        lens = factories.lens_type(compatible_with=frame)
        cart_add_item(user=user, frame_variant_id=frame.id, lens_type_id=lens.id,
                      prescription_id=factories.prescription(user).id)
    else:
        cart_add_item(user=user, product_id=factories.product(f'item-{Order.objects.count()}').id)
    order = order_create_from_cart(user=user, shipping_address='1 Test Street')
    return order_process_payment(order=order, actor=user, payment_reference='REF') if paid else order


@pytest.fixture
def ops():
    return make_user('ops@naderk.test', role=User.Role.OPERATIONS_MANAGER)


# ── Seeing orders ────────────────────────────────────────────────────────────

def test_customer_lists_only_their_own_orders_newest_first(patient, other_patient):
    first, second = order_for(patient), order_for(patient)
    order_for(other_patient)

    rows = client_for(patient).get(ORDERS).json()['data']

    assert [row['id'] for row in rows] == [str(second.id), str(first.id)]


def test_order_detail_carries_items_and_the_activity_trail(patient):
    order = order_for(patient)

    data = client_for(patient).get(f'{ORDERS}{order.id}/').json()['data']

    assert data['payment_status'] == 'PAID'
    assert len(data['items']) == 1
    assert [a['action'] for a in data['activities']] == ['CREATED', 'PAID', 'FRAME_RESERVED']


def test_another_customer_cannot_open_the_order(patient, other_patient):
    order = order_for(patient)

    assert client_for(other_patient).get(f'{ORDERS}{order.id}/').status_code == 403


def test_unknown_order_is_404_and_orders_need_sign_in(patient, api_client):
    assert client_for(patient).get(f'{ORDERS}00000000-0000-0000-0000-000000000000/').status_code == 404
    assert api_client.get(ORDERS).status_code == 401


def test_staff_only_notes_are_not_sent_to_the_customer(patient):
    order = order_for(patient)
    Order.objects.filter(pk=order.pk).update(internal_notes='Customer was rude on the phone')

    data = client_for(patient).get(f'{ORDERS}{order.id}/').json()['data']

    assert 'Customer was rude' not in str(data)


# ── Fulfilment ───────────────────────────────────────────────────────────────

def advance(user, order, status, **extra):
    return client_for(user).patch(f'{ORDERS}{order.id}/status/', {'status': status, **extra}, format='json')


def test_staff_move_an_order_forward_through_production(patient, ops):
    order = order_for(patient)

    for step in [S.IN_PRODUCTION, S.LENS_CUTTING, S.FRAME_ASSEMBLY, S.QUALITY_CHECK, S.SHIPPED]:
        assert advance(ops, order, step).status_code == 200, step

    order.refresh_from_db()
    assert order.status == S.SHIPPED
    assert order.activities.filter(action='STATUS_SHIPPED').exists()


def test_stages_may_be_skipped_but_never_reversed(patient, ops):
    order = order_for(patient)
    advance(ops, order, S.QUALITY_CHECK)

    res = advance(ops, order, S.IN_PRODUCTION)

    assert res.status_code == 400
    order.refresh_from_db()
    assert order.status == S.QUALITY_CHECK


def test_status_notes_are_kept_and_lowercase_is_accepted(patient, ops):
    order = order_for(patient)

    advance(ops, order, 'in_production', notes='Lenses ordered')

    order.refresh_from_db()
    assert (order.status, order.production_notes) == (S.IN_PRODUCTION, 'Lenses ordered')


@pytest.mark.parametrize('status', ['', 'NOT_A_STATUS'])
def test_bad_status_is_refused(patient, ops, status):
    assert advance(ops, order_for(patient), status).status_code == 400


def test_an_unpaid_order_cannot_be_put_into_production(patient, ops):
    order = order_for(patient, paid=False)

    assert advance(ops, order, S.IN_PRODUCTION).status_code == 400


@pytest.mark.parametrize('role', [User.Role.PATIENT, User.Role.DOCTOR, User.Role.AGENT])
def test_only_order_staff_change_status(patient, role):
    order = order_for(patient)
    user = patient if role == User.Role.PATIENT else make_user('x@naderk.test', role=role)

    assert advance(user, order, S.IN_PRODUCTION).status_code == 403


def test_a_delivered_order_cannot_be_cancelled_and_a_cancelled_one_cannot_be_revived(patient, ops):
    delivered, cancelled = order_for(patient), order_for(patient)
    order_update_status(order=delivered, actor=ops, new_status=S.DELIVERED)
    order_update_status(order=cancelled, actor=ops, new_status=S.CANCELLED)

    with pytest.raises(ValidationError):
        order_update_status(order=delivered, actor=ops, new_status=S.CANCELLED)
    with pytest.raises(ValidationError):
        order_update_status(order=cancelled, actor=ops, new_status=S.IN_PRODUCTION)


def test_setting_the_current_status_again_is_a_no_op(patient, ops):
    order = order_for(patient)
    before = order.activities.count()

    order_update_status(order=order, actor=ops, new_status=order.status)

    assert order.activities.count() == before


# ── Customer confirms delivery ───────────────────────────────────────────────

def confirm(user, order):
    return client_for(user).post(f'{ORDERS}{order.id}/confirm-delivery/')


def test_customer_confirms_a_shipped_order(patient, ops):
    order = order_for(patient)
    advance(ops, order, S.SHIPPED)

    assert confirm(patient, order).status_code == 200
    order.refresh_from_db()
    assert order.status == S.DELIVERED


def test_delivery_cannot_be_confirmed_before_shipping_or_by_someone_else(patient, other_patient, ops):
    order = order_for(patient)
    assert confirm(patient, order).status_code == 400

    advance(ops, order, S.SHIPPED)
    assert confirm(other_patient, order).status_code == 403
    assert confirm(ops, order).status_code == 403


# ── Prescription review ──────────────────────────────────────────────────────

REVIEW_QUEUE = f'{ORDERS}review-queue/'


def review(user, order, **body):
    return client_for(user).post(f'{ORDERS}{order.id}/review/', body, format='json')


def test_orders_with_a_prescription_wait_in_the_review_queue_oldest_first(patient, other_patient, doctor):
    first = order_for(patient, with_prescription=True)
    second = order_for(other_patient, with_prescription=True)
    order_for(patient)                                   # no prescription, not queued

    rows = client_for(doctor).get(REVIEW_QUEUE).json()['data']

    assert [row['id'] for row in rows] == [str(first.id), str(second.id)]
    assert rows[0]['items'][0]['prescription_snapshot']['pupillary_distance'] == 62.0


def test_approving_releases_the_order_to_production(patient, doctor):
    order = order_for(patient, with_prescription=True)

    res = review(doctor, order, action='approve', notes='Values check out')

    assert res.status_code == 200, res.content
    order.refresh_from_db()
    assert (order.status, order.internal_notes) == (S.FRAME_RESERVED, 'Values check out')
    assert client_for(doctor).get(REVIEW_QUEUE).json()['data'] == []


def test_rejecting_cancels_the_order(patient, doctor):
    order = order_for(patient, with_prescription=True)

    review(doctor, order, action='reject', notes='Axis missing')

    order.refresh_from_db()
    assert order.status == S.CANCELLED
    assert order.activities.filter(action='CANCELLED').exists()


def test_review_refusals(patient, doctor, ops):
    in_review = order_for(patient, with_prescription=True)
    not_in_review = order_for(patient)

    assert review(doctor, in_review, action='maybe').status_code == 400
    assert review(doctor, not_in_review, action='approve').status_code == 400
    assert review(patient, in_review, action='approve').status_code == 403
    assert review(ops, in_review, action='approve').status_code == 403      # stock, not clinical
    assert client_for(patient).get(REVIEW_QUEUE).status_code == 403
    in_review.refresh_from_db()
    assert in_review.status == S.PRESCRIPTION_REVIEW
