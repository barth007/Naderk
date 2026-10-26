"""A cart line can only carry the shopper's own prescription."""
import pytest
from django.core.exceptions import ValidationError

from naderk.ecommerce.models import CartItem
from naderk.ecommerce.services import cart_add_item
from naderk.ecommerce.tests import factories
from tests.helpers import client_for

pytestmark = pytest.mark.django_db


def glasses(prescription):
    frame = factories.frame_variant()
    lens = factories.lens_type(compatible_with=frame)
    return {'frame_variant_id': frame.id, 'lens_type_id': lens.id, 'prescription_id': prescription.id}


def test_own_prescription_is_accepted(patient):
    item = cart_add_item(user=patient, **glasses(factories.prescription(patient)))

    assert item.prescription.patient == patient


def test_someone_elses_prescription_is_refused(patient, other_patient):
    theirs = factories.prescription(other_patient)

    with pytest.raises(ValidationError):
        cart_add_item(user=patient, **glasses(theirs))

    assert not CartItem.objects.exists()


def test_api_does_not_reveal_someone_elses_prescription(patient, other_patient):
    theirs = factories.prescription(other_patient)
    body = {key: str(value) for key, value in glasses(theirs).items()}

    res = client_for(patient).post('/api/v1/marketplace/cart/add/', body, format='json')

    assert res.status_code == 400, res.content
    assert other_patient.email not in res.content.decode()
