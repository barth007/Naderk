"""Eyewear prescriptions: submitting, who can read them, and clinical review."""
from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from naderk.core.models import User
from naderk.ecommerce.models import Prescription
from naderk.ecommerce.tests import factories
from tests.helpers import client_for, make_user

pytestmark = pytest.mark.django_db

RX = '/api/v1/marketplace/prescriptions/'
VALID = {'right_sph': '-1.50', 'left_sph': '-1.25', 'pupillary_distance': '62.0'}


def submit(user, **body):
    return client_for(user).post(RX, {**VALID, **body}, format='json')


def test_patient_submits_a_prescription_for_review(patient):
    res = submit(patient)

    assert res.status_code == 201, res.content
    rx = Prescription.objects.get()
    assert (rx.patient, rx.status) == (patient, Prescription.Status.PENDING_REVIEW)
    assert rx.expires_at == timezone.now().date() + timedelta(days=365)
    assert rx.activities.filter(action='CREATED').exists()


def test_patient_cannot_set_the_status_or_the_owner(patient, other_patient):
    submit(patient, status='APPROVED', patient=str(other_patient.id), patient_id=str(other_patient.id))

    rx = Prescription.objects.get()
    assert (rx.patient, rx.status) == (patient, Prescription.Status.PENDING_REVIEW)


@pytest.mark.parametrize('body, field', [
    ({'right_sph': '-25.00'}, 'right_sph'), ({'left_cyl': '11.00'}, 'left_cyl'),
    ({'right_axis': 181}, 'right_axis'), ({'pupillary_distance': '30'}, 'pupillary_distance'),
])
def test_out_of_range_values_are_refused(patient, body, field):
    res = submit(patient, **body)

    assert res.status_code == 400
    assert field in res.json()['errors']
    assert not Prescription.objects.exists()


def test_a_doctors_own_prescription_is_approved_at_once(patient, doctor):
    res = submit(doctor, patient_id=str(patient.id))

    assert res.status_code == 201, res.content
    rx = Prescription.objects.get()
    assert (rx.patient, rx.status) == (patient, Prescription.Status.APPROVED)
    assert rx.review.reviewed_by == doctor


def test_staff_submitting_for_an_unknown_patient_is_404(doctor):
    assert submit(doctor, patient_id='00000000-0000-0000-0000-000000000000').status_code == 404


# ── Reading ──────────────────────────────────────────────────────────────────

def test_patient_lists_and_opens_only_their_own(patient, other_patient):
    mine, theirs = factories.prescription(patient), factories.prescription(other_patient)
    client = client_for(patient)

    assert [row['id'] for row in client.get(RX).json()['data']] == [str(mine.id)]
    assert client.get(f'{RX}{mine.id}/').status_code == 200
    assert client.get(f'{RX}{theirs.id}/').status_code == 404
    # A patient cannot use the staff filter to read someone else's list.
    assert [row['id'] for row in client.get(RX, {'patient_id': str(other_patient.id)}).json()['data']] == [str(mine.id)]


def test_doctor_reads_a_named_patients_prescriptions(patient, doctor):
    rx = factories.prescription(patient)

    rows = client_for(doctor).get(RX, {'patient_id': str(patient.id)}).json()['data']

    assert [row['id'] for row in rows] == [str(rx.id)]
    assert client_for(doctor).get(f'{RX}{rx.id}/').status_code == 200


def test_reusable_list_is_approved_and_unexpired_only(patient):
    approved = factories.prescription(patient)
    pending, expired = factories.prescription(patient), factories.prescription(patient)
    Prescription.objects.filter(pk=approved.pk).update(status='APPROVED')
    Prescription.objects.filter(pk=expired.pk).update(status='APPROVED', expires_at=timezone.now().date() - timedelta(days=1))

    rows = client_for(patient).get(f'{RX}reusable/').json()['data']

    assert [row['id'] for row in rows] == [str(approved.id)]
    assert pending.status == 'PENDING_REVIEW'


def test_expired_flag(patient):
    rx = factories.prescription(patient)
    Prescription.objects.filter(pk=rx.pk).update(expires_at=timezone.now().date() - timedelta(days=1))

    assert client_for(patient).get(f'{RX}{rx.id}/').json()['data']['is_expired'] is True


# ── Review ───────────────────────────────────────────────────────────────────

def review(user, rx, **body):
    return client_for(user).post(f'{RX}{rx.id}/review/', body, format='json')


def test_review_queue_and_decision(patient, doctor):
    rx = factories.prescription(patient)
    queue = f'{RX}review-queue/'

    assert [row['id'] for row in client_for(doctor).get(queue).json()['data']] == [str(rx.id)]
    assert review(doctor, rx, status='UNDER_REVIEW').status_code == 200
    assert [row['id'] for row in client_for(doctor).get(queue).json()['data']] == [str(rx.id)]

    res = review(doctor, rx, status='APPROVED', review_notes='Looks right')

    assert res.status_code == 200, res.content
    rx.refresh_from_db()
    assert (rx.status, rx.review.review_notes, rx.review.reviewed_by) == ('APPROVED', 'Looks right', doctor)
    assert client_for(doctor).get(queue).json()['data'] == []
    assert list(rx.activities.order_by('created_at').values_list('action', flat=True))[-2:] == ['UNDER_REVIEW', 'APPROVED']


@pytest.mark.parametrize('status', ['REQUIRES_CORRECTION', 'REJECTED'])
def test_other_outcomes(patient, doctor, status):
    rx = factories.prescription(patient)

    review(doctor, rx, status=status)

    rx.refresh_from_db()
    assert rx.status == status


def test_review_refusals(patient, doctor):
    rx = factories.prescription(patient)

    assert review(doctor, rx).status_code == 400                       # no status
    assert review(doctor, rx, status='PENDING_REVIEW').status_code == 400
    assert review(patient, rx, status='APPROVED').status_code == 403
    assert client_for(patient).get(f'{RX}review-queue/').status_code == 403
    assert review(doctor, Prescription(id='00000000-0000-0000-0000-000000000000'), status='APPROVED').status_code == 404
    rx.refresh_from_db()
    assert rx.status == 'PENDING_REVIEW'


@pytest.mark.xfail(strict=True, reason=(
    'The prescription review endpoints only admit is_staff, ADMIN and DOCTOR. OPTICIAN, the role the '
    'review workflow is written for, and SUPER_ADMIN are refused.'
))
@pytest.mark.parametrize('role', [User.Role.OPTICIAN, User.Role.SUPER_ADMIN])
def test_opticians_and_super_admins_can_review(patient, role):
    rx = factories.prescription(patient)

    assert review(make_user('reviewer@naderk.test', role=role), rx, status='APPROVED').status_code == 200
