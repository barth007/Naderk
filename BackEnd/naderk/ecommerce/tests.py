from django.test import TestCase
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.contrib.auth import get_user_model
from datetime import date, timedelta
from decimal import Decimal

from .models import (
    StoreCategory, Product, ProductVariant, Frame, FrameVariant,
    LensType, FrameLensCompatibility, LensOption, Prescription,
    Cart, CartItem, Wishlist, WishlistItem, Order, OrderItem,
    OrderActivity, PrescriptionActivity
)
from .serializers import AddToCartSerializer
from .services import (
    prescription_create, prescription_assign_for_review, prescription_review_complete,
    cart_add_item, cart_update_item_quantity, cart_remove_item, cart_clear,
    wishlist_toggle_item, order_create_from_cart, order_process_payment
)

User = get_user_model()

class EcommerceTestCase(TestCase):
    def setUp(self):
        # Create users
        self.patient = User.objects.create_user(
            email='patient@example.com',
            password='testpassword',
            first_name='Patient',
            last_name='User',
            role=User.Role.PATIENT
        )
        self.optician = User.objects.create_user(
            email='optician@example.com',
            password='testpassword',
            first_name='Optician',
            last_name='User',
            role=User.Role.DOCTOR,
            is_staff=True
        )
        
        # Create category
        self.category = StoreCategory.objects.create(
            name='Optical',
            slug='optical'
        )
        
        # Create a product
        self.product = Product.objects.create(
            name='Vitamins A',
            slug='vitamins-a',
            description='Eye care kit supplements',
            category=self.category,
            price=Decimal('25.00'),
            quantity_available=20,
            low_stock_threshold=5
        )
        # Variant
        self.variant = ProductVariant.objects.create(
            product=self.product,
            variant_name='30 Capsules',
            sku='VIT-A-30',
            quantity_available=10,
            low_stock_threshold=3,
            price_modifier=Decimal('5.00')
        )
        
        # Eyewear catalog
        self.frame = Frame.objects.create(
            name='Classic Wayfarer',
            brand='RayBan',
            style='Wayfarer',
            material='Acetate',
            base_price=Decimal('120.00')
        )
        self.frame_variant = FrameVariant.objects.create(
            frame=self.frame,
            color='Black',
            size='Medium',
            quantity_available=8,
            low_stock_threshold=2,
            sku='RB-WAY-BLK-MD'
        )
        
        self.lens_type_prescription = LensType.objects.create(
            name='Single Vision',
            description='Standard prescription vision lens',
            price_modifier=Decimal('40.00')
        )
        self.lens_type_non_pres = LensType.objects.create(
            name='Non-Prescription',
            description='Plano or blue light filter lens',
            price_modifier=Decimal('10.00')
        )
        
        # Enable compatibility
        FrameLensCompatibility.objects.create(
            frame=self.frame,
            lens_type=self.lens_type_prescription
        )
        FrameLensCompatibility.objects.create(
            frame=self.frame,
            lens_type=self.lens_type_non_pres
        )
        
        self.lens_option = LensOption.objects.create(
            name='Anti-Reflective Coating',
            price_modifier=Decimal('15.00')
        )

    def test_prescription_manual_validation(self):
        """
        Verify manual prescription validation limits (SPH, CYL, AXIS, PD).
        """
        # Valid prescription create should succeed
        pres = prescription_create(
            patient=self.patient,
            right_sph=Decimal('-2.50'),
            right_cyl=Decimal('-1.25'),
            right_axis=90,
            left_sph=Decimal('-2.00'),
            left_cyl=Decimal('-1.00'),
            left_axis=105,
            pupillary_distance=Decimal('63.0')
        )
        self.assertEqual(pres.status, Prescription.Status.PENDING_REVIEW)
        self.assertEqual(pres.patient, self.patient)
        self.assertTrue(PrescriptionActivity.objects.filter(prescription=pres, action='CREATED').exists())
        
        # Serializer validation: Axis limit (0 to 180)
        from .serializers import PrescriptionSerializer
        
        serializer = PrescriptionSerializer(data={
            'right_sph': -2.50,
            'right_cyl': -1.25,
            'right_axis': 195,  # Invalid
            'pupillary_distance': 63.0
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('right_axis', serializer.errors)
        
        # Serializer validation: Pupillary distance limit (40 to 80)
        serializer2 = PrescriptionSerializer(data={
            'pupillary_distance': 35.0  # Invalid
        })
        self.assertFalse(serializer2.is_valid())
        self.assertIn('pupillary_distance', serializer2.errors)
        
        # Serializer validation: SPH limits (-20 to +20)
        serializer3 = PrescriptionSerializer(data={
            'right_sph': -25.00,  # Invalid
            'pupillary_distance': 63.0
        })
        self.assertFalse(serializer3.is_valid())
        self.assertIn('right_sph', serializer3.errors)

    def test_frame_lens_compatibility_and_cart_addition(self):
        """
        Test frame-lens compatibility verification and adding configured items.
        """
        # Create another frame that has no compatibilities
        frame2 = Frame.objects.create(
            name='Round Lite',
            brand='Oakley',
            style='Round',
            material='Titanium',
            base_price=Decimal('180.00')
        )
        frame2_variant = FrameVariant.objects.create(
            frame=frame2,
            color='Silver',
            size='Large',
            quantity_available=5
        )
        
        # Create a valid approved prescription
        pres = prescription_create(
            patient=self.patient,
            pupillary_distance=Decimal('64.0')
        )
        prescription_assign_for_review(prescription=pres, optician=self.optician)
        prescription_review_complete(prescription=pres, optician=self.optician, status=Prescription.Status.APPROVED)

        # Add to cart: frame2_variant with prescription lens should FAIL validation (incompatible)
        data = {
            'frame_variant_id': str(frame2_variant.id),
            'lens_type_id': str(self.lens_type_prescription.id),
            'prescription_id': str(pres.id),
            'quantity': 1
        }
        serializer = AddToCartSerializer(data=data)
        # Incompatibility validation occurs inside AddToCartSerializer.validate()
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        self.assertTrue(any("is incompatible" in str(err) for err in serializer.errors['non_field_errors']))

    def test_add_to_cart_requires_approved_prescription(self):
        """
        Verify that adding eyewear with a prescription lens requires an APPROVED, non-expired prescription.
        """
        # 1. Create a pending prescription
        pres = prescription_create(
            patient=self.patient,
            pupillary_distance=Decimal('64.0')
        )
        
        # Attempt to add to cart: should FAIL because prescription is not APPROVED
        data = {
            'frame_variant_id': str(self.frame_variant.id),
            'lens_type_id': str(self.lens_type_prescription.id),
            'prescription_id': str(pres.id),
            'quantity': 1
        }
        serializer = AddToCartSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('non_field_errors', serializer.errors)
        self.assertTrue(any("must be APPROVED" in str(err) for err in serializer.errors['non_field_errors']))
        
        # 2. Approve prescription
        prescription_assign_for_review(prescription=pres, optician=self.optician)
        prescription_review_complete(prescription=pres, optician=self.optician, status=Prescription.Status.APPROVED)
        
        # Re-attempt: should succeed
        serializer2 = AddToCartSerializer(data=data)
        self.assertTrue(serializer2.is_valid())
        
        # Actually add to cart via service
        cart_item = cart_add_item(
            user=self.patient,
            frame_variant_id=self.frame_variant.id,
            lens_type_id=self.lens_type_prescription.id,
            prescription_id=pres.id,
            lens_option_ids=[self.lens_option.id],
            quantity=1
        )
        self.assertIsNotNone(cart_item)
        # Verify calculated price: base frame price + lens type + lens option modifier
        # 120.00 + 40.00 + 15.00 = 175.00
        self.assertEqual(cart_item.price, Decimal('175.00'))

    def test_checkout_prescription_expiration_and_snapshot(self):
        """
        Verify checkout blocks expired prescriptions (>12 months) and snapshotted values are locked in OrderItem.
        """
        # Create an APPROVED prescription that has expired (expires_at in past)
        pres_expired = prescription_create(
            patient=self.patient,
            pupillary_distance=Decimal('60.0'),
            expires_at=timezone.now().date() - timedelta(days=5)
        )
        prescription_assign_for_review(prescription=pres_expired, optician=self.optician)
        prescription_review_complete(prescription=pres_expired, optician=self.optician, status=Prescription.Status.APPROVED)
        
        # Try to checkout with it.
        # We manually add to cart (since validation at addition might check it, but we also check at checkout)
        cart_item = cart_add_item(
            user=self.patient,
            frame_variant_id=self.frame_variant.id,
            lens_type_id=self.lens_type_prescription.id,
            prescription_id=pres_expired.id,
            quantity=1
        )
        
        # Checkout should raise ValidationError
        with self.assertRaises(DjangoValidationError):
            order_create_from_cart(user=self.patient, shipping_address="123 Test Street")
            
        # Clean cart
        cart_clear(user=self.patient)
        
        # Now create an APPROVED prescription that is valid
        pres_valid = prescription_create(
            patient=self.patient,
            right_sph=Decimal('-1.50'),
            left_sph=Decimal('-1.50'),
            pupillary_distance=Decimal('62.0')
        )
        prescription_assign_for_review(prescription=pres_valid, optician=self.optician)
        prescription_review_complete(prescription=pres_valid, optician=self.optician, status=Prescription.Status.APPROVED)
        
        cart_item2 = cart_add_item(
            user=self.patient,
            frame_variant_id=self.frame_variant.id,
            lens_type_id=self.lens_type_prescription.id,
            prescription_id=pres_valid.id,
            quantity=1
        )
        
        order = order_create_from_cart(user=self.patient, shipping_address="123 Test Street")
        self.assertEqual(order.status, Order.Status.PENDING)
        
        # Verify the OrderItem and its prescription snapshot
        order_item = order.items.first()
        self.assertIsNotNone(order_item.prescription_snapshot)
        self.assertEqual(order_item.prescription_snapshot['right_sph'], -1.5)
        self.assertEqual(order_item.prescription_snapshot['pupillary_distance'], 62.0)
        self.assertEqual(order_item.prescription_snapshot['patient_email'], self.patient.email)

    def test_payment_stock_allocation_and_threshold_warnings(self):
        """
        Verify available quantity drops and OrderActivity logging / stock threshold warnings.
        """
        # Add a normal product and variant to cart
        cart_add_item(
            user=self.patient,
            product_id=self.product.id,
            product_variant_id=self.variant.id,
            quantity=8  # available in setup: 10. Remaining will be 2 (below threshold 3!)
        )
        
        # Add frame to cart
        cart_add_item(
            user=self.patient,
            product_id=None,
            frame_variant_id=self.frame_variant.id,
            lens_type_id=self.lens_type_non_pres.id,
            quantity=7  # available: 8. Remaining will be 1 (below threshold 2!)
        )
        
        order = order_create_from_cart(user=self.patient, shipping_address="123 Test Street")
        
        # Process payment
        order_process_payment(order=order, actor=self.patient, payment_reference="PAY-1234")
        
        # Refresh from db
        self.variant.refresh_from_db()
        self.frame_variant.refresh_from_db()
        order.refresh_from_db()
        
        # Verify stock dropped
        self.assertEqual(self.variant.quantity_available, 2)
        self.assertEqual(self.frame_variant.quantity_available, 1)
        self.assertEqual(order.payment_status, Order.PaymentStatus.PAID)
        self.assertEqual(order.status, Order.Status.FRAME_RESERVED)
        
        # Verify Order activities
        activities = list(order.activities.all())
        self.assertTrue(any(act.action == 'PAID' for act in activities))
        
        reserved_act = order.activities.get(action='FRAME_RESERVED')
        self.assertIsNotNone(reserved_act.metadata)
        warnings = reserved_act.metadata.get('low_stock_warnings')
        self.assertIsNotNone(warnings)
        self.assertEqual(len(warnings), 2)
        
        # Assert categories of warnings
        warning_types = [w['type'] for w in warnings]
        self.assertIn('product_variant', warning_types)
        self.assertIn('frame_variant', warning_types)
