import logging
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from typing import Optional, List
from decimal import Decimal
from datetime import timedelta

from .models import (
    StoreCategory, Product, ProductVariant, Frame, FrameVariant,
    LensType, FrameLensCompatibility, LensOption, Prescription,
    PrescriptionReview, PrescriptionActivity, Cart, CartItem,
    Wishlist, WishlistItem, Order, OrderItem, OrderActivity
)

logger = logging.getLogger(__name__)
User = get_user_model()

def prescription_create(*, patient: User, **data) -> Prescription:
    # Explicit status override is not allowed for patient creation
    data.pop('status', None)
    
    # Calculate expires_at if not provided (default 12 months)
    expires_at = data.get('expires_at')
    if not expires_at:
        expires_at = timezone.now().date() + timedelta(days=365)
        data['expires_at'] = expires_at
        
    prescription = Prescription.objects.create(
        patient=patient,
        status=Prescription.Status.PENDING_REVIEW,
        **data
    )
    
    PrescriptionActivity.objects.create(
        prescription=prescription,
        actor=patient,
        action='CREATED',
        metadata={'expires_at': str(prescription.expires_at)}
    )
    return prescription

def prescription_assign_for_review(*, prescription: Prescription, optician: User) -> Prescription:
    prescription.status = Prescription.Status.UNDER_REVIEW
    prescription.save()
    
    PrescriptionReview.objects.update_or_create(
        prescription=prescription,
        defaults={
            'reviewed_by': optician,
            'reviewed_at': timezone.now()
        }
    )
    
    PrescriptionActivity.objects.create(
        prescription=prescription,
        actor=optician,
        action='UNDER_REVIEW'
    )
    return prescription

def prescription_review_complete(*, prescription: Prescription, optician: User, status: str, review_notes: Optional[str] = None) -> Prescription:
    if status not in [Prescription.Status.APPROVED, Prescription.Status.REQUIRES_CORRECTION, Prescription.Status.REJECTED]:
        raise ValidationError("Invalid review completion status.")
        
    prescription.status = status
    prescription.save()
    
    PrescriptionReview.objects.update_or_create(
        prescription=prescription,
        defaults={
            'reviewed_by': optician,
            'reviewed_at': timezone.now(),
            'review_notes': review_notes
        }
    )
    
    PrescriptionActivity.objects.create(
        prescription=prescription,
        actor=optician,
        action=status,
        metadata={'review_notes': review_notes or ''}
    )
    return prescription

def cart_add_item(*, user: User, product_id: Optional[str] = None, product_variant_id: Optional[str] = None,
                  frame_variant_id: Optional[str] = None, lens_type_id: Optional[str] = None,
                  lens_option_ids: Optional[List[str]] = None, prescription_id: Optional[str] = None,
                  quantity: int = 1) -> CartItem:
    
    cart, _ = Cart.objects.get_or_create(user=user)
    
    if product_id:
        product = Product.objects.get(id=product_id)
        product_variant = None
        price = product.price
        
        if product_variant_id:
            product_variant = ProductVariant.objects.get(id=product_variant_id, product=product)
            price += product_variant.price_modifier
            
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            product_variant=product_variant,
            frame_variant=None,
            lens_type=None,
            prescription=None,
            defaults={'price': price, 'quantity': quantity}
        )
        if not created:
            cart_item.quantity += quantity
            cart_item.save()
            
    elif frame_variant_id:
        frame_variant = FrameVariant.objects.get(id=frame_variant_id)
        # Lens is optional — a patient can buy a frame on its own (frame-only purchase)
        lens_type = LensType.objects.get(id=lens_type_id) if lens_type_id else None
        prescription = None
        if prescription_id:
            prescription = Prescription.objects.get(id=prescription_id)

        # Base Price (+ lens modifier only when a lens was chosen)
        price = frame_variant.frame.base_price
        if lens_type:
            price += lens_type.price_modifier
        
        # We need to construct or get the CartItem
        # Note: multiple items of the exact same glasses config can be grouped.
        # But we must check if lens_options match.
        lens_options_list = []
        if lens_option_ids:
            lens_options_list = list(LensOption.objects.filter(id__in=lens_option_ids))
            price += sum(opt.price_modifier for opt in lens_options_list)
            
        # To find matching item, check item having same configuration
        # Since lens_options is many-to-many, we'll find existing cart items for this cart
        existing_items = CartItem.objects.filter(
            cart=cart,
            frame_variant=frame_variant,
            lens_type=lens_type,
            prescription=prescription
        )
        
        target_item = None
        for item in existing_items:
            # Check if M2M lens options are exactly the same
            item_opts = set(item.lens_options.all())
            search_opts = set(lens_options_list)
            if item_opts == search_opts:
                target_item = item
                break
                
        if target_item:
            target_item.quantity += quantity
            target_item.price = price  # update to latest calculated price
            target_item.save()
            cart_item = target_item
        else:
            cart_item = CartItem.objects.create(
                cart=cart,
                frame_variant=frame_variant,
                lens_type=lens_type,
                prescription=prescription,
                price=price,
                quantity=quantity
            )
            if lens_options_list:
                cart_item.lens_options.set(lens_options_list)
                
    else:
        raise ValidationError("Either product_id or frame_variant_id must be provided.")
        
    return cart_item

def cart_update_item_quantity(*, user: User, item_id: str, quantity: int) -> CartItem:
    cart, _ = Cart.objects.get_or_create(user=user)
    try:
        item = CartItem.objects.get(id=item_id, cart=cart)
    except CartItem.DoesNotExist:
        raise ValidationError("Cart item does not exist.")
        
    if quantity <= 0:
        item.delete()
        return None
        
    item.quantity = quantity
    item.save()
    return item

def cart_remove_item(*, user: User, item_id: str):
    cart, _ = Cart.objects.get_or_create(user=user)
    CartItem.objects.filter(id=item_id, cart=cart).delete()

def cart_clear(*, user: User):
    cart, _ = Cart.objects.get_or_create(user=user)
    CartItem.objects.filter(cart=cart).delete()

def wishlist_toggle_item(*, user: User, product_id: Optional[str] = None, frame_variant_id: Optional[str] = None) -> tuple:
    wishlist, _ = Wishlist.objects.get_or_create(user=user)
    
    if not product_id and not frame_variant_id:
        raise ValidationError("Either product_id or frame_variant_id must be provided.")
        
    if product_id and frame_variant_id:
        raise ValidationError("Cannot wishlist both a product and frame variant together in one record.")
        
    if product_id:
        product = Product.objects.get(id=product_id)
        item, created = WishlistItem.objects.get_or_create(wishlist=wishlist, product=product)
        if not created:
            item.delete()
            return None, False
        return item, True
    else:
        frame_variant = FrameVariant.objects.get(id=frame_variant_id)
        item, created = WishlistItem.objects.get_or_create(wishlist=wishlist, frame_variant=frame_variant)
        if not created:
            item.delete()
            return None, False
        return item, True

@transaction.atomic
def order_create_from_cart(*, user: User, shipping_address: str, payment_reference: Optional[str] = None) -> Order:
    cart, _ = Cart.objects.get_or_create(user=user)
    cart_items = cart.items.all()
    if not cart_items.exists():
        raise ValidationError("Cannot checkout with an empty cart.")
        
    # Validation checks
    # Approval is NOT required here — clinical review happens after payment
    # (order routes to PRESCRIPTION_REVIEW status). Only check expiry.
    for item in cart_items:
        if item.prescription:
            if item.prescription.expires_at and item.prescription.expires_at < timezone.now().date():
                raise ValidationError("Prescription has expired.")
            if item.prescription.created_at < timezone.now() - timedelta(days=365):
                raise ValidationError("Prescription is older than 12 months and is expired.")
                
    # Calculate totals
    total_price = sum(item.price * item.quantity for item in cart_items)
    
    order = Order.objects.create(
        user=user,
        status=Order.Status.PENDING,
        payment_status=Order.PaymentStatus.UNPAID,
        total_price=total_price,
        shipping_address=shipping_address,
        payment_reference=payment_reference
    )
    
    # Create OrderItems & Snapshots
    for item in cart_items:
        order_item = OrderItem.objects.create(
            order=order,
            product=item.product,
            product_variant=item.product_variant,
            frame_variant=item.frame_variant,
            lens_type=item.lens_type,
            prescription=item.prescription,
            price=item.price,
            quantity=item.quantity
        )
        if item.lens_options.exists():
            order_item.lens_options.set(item.lens_options.all())
            
        # Create Snapshot of Prescription
        if item.prescription:
            order_item.prescription_snapshot = {
                'id': str(item.prescription.id),
                'right_sph': float(item.prescription.right_sph) if item.prescription.right_sph is not None else None,
                'right_cyl': float(item.prescription.right_cyl) if item.prescription.right_cyl is not None else None,
                'right_axis': item.prescription.right_axis,
                'right_add': float(item.prescription.right_add) if item.prescription.right_add is not None else None,
                'left_sph': float(item.prescription.left_sph) if item.prescription.left_sph is not None else None,
                'left_cyl': float(item.prescription.left_cyl) if item.prescription.left_cyl is not None else None,
                'left_axis': item.prescription.left_axis,
                'left_add': float(item.prescription.left_add) if item.prescription.left_add is not None else None,
                'pupillary_distance': float(item.prescription.pupillary_distance),
                'prescription_file': item.prescription.prescription_file,
                'status': item.prescription.status,
                'expires_at': str(item.prescription.expires_at) if item.prescription.expires_at else None,
                'patient_email': item.prescription.patient.email,
            }
            order_item.save()
            
    OrderActivity.objects.create(
        order=order,
        actor=user,
        action='CREATED'
    )
    
    # If payment_reference was provided at checkout, trigger payment logic
    if payment_reference:
        order_process_payment(order=order, actor=user, payment_reference=payment_reference)
        
    # Clear cart
    cart_items.delete()
    return order

@transaction.atomic
def order_process_payment(*, order: Order, actor: User, payment_reference: str, skip_verify: bool = False) -> Order:
    # Lock the row so concurrent webhook retries can't both pass the PAID check
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.payment_status == Order.PaymentStatus.PAID:
        return order

    # Verify payment with provider unless the caller already verified (e.g. webhook path)
    if not skip_verify:
        from naderk.payments.services import verify_and_confirm
        try:
            result = verify_and_confirm(reference=payment_reference)
        except Exception as e:
            raise ValidationError(f"Payment verification failed: {e}")
        if result.status != 'success':
            raise ValidationError(f"Payment not confirmed by provider (status: {result.status}). Please complete payment before proceeding.")

    # Deduct stock and check compatibility
    low_stock_warnings = []
    
    for item in order.items.all():
        if item.product_variant:
            pv = item.product_variant
            if pv.quantity_available < item.quantity:
                raise ValidationError(f"Insufficient stock for {pv.product.name} ({pv.variant_name}). Available: {pv.quantity_available}")
            pv.quantity_available -= item.quantity
            pv.save()
            
            if pv.quantity_available <= pv.low_stock_threshold:
                low_stock_warnings.append({
                    'type': 'product_variant',
                    'id': str(pv.id),
                    'name': f"{pv.product.name} ({pv.variant_name})",
                    'remaining': pv.quantity_available
                })
                logger.warning(f"Low stock warning: {pv.product.name} ({pv.variant_name}) is at {pv.quantity_available} units.")
                
        elif item.product:
            p = item.product
            if p.quantity_available < item.quantity:
                raise ValidationError(f"Insufficient stock for {p.name}. Available: {p.quantity_available}")
            p.quantity_available -= item.quantity
            p.save()
            
            if p.quantity_available <= p.low_stock_threshold:
                low_stock_warnings.append({
                    'type': 'product',
                    'id': str(p.id),
                    'name': p.name,
                    'remaining': p.quantity_available
                })
                logger.warning(f"Low stock warning: {p.name} is at {p.quantity_available} units.")
                
        elif item.frame_variant:
            fv = item.frame_variant
            if fv.quantity_available < item.quantity:
                raise ValidationError(f"Insufficient stock for frame {fv.frame.name} ({fv.color}/{fv.size}). Available: {fv.quantity_available}")
            fv.quantity_available -= item.quantity
            fv.save()
            
            if fv.quantity_available <= fv.low_stock_threshold:
                low_stock_warnings.append({
                    'type': 'frame_variant',
                    'id': str(fv.id),
                    'name': f"{fv.frame.name} ({fv.color}/{fv.size})",
                    'remaining': fv.quantity_available
                })
                logger.warning(f"Low stock warning: Frame {fv.frame.name} ({fv.color}/{fv.size}) is at {fv.quantity_available} units.")
                
    order.payment_status = Order.PaymentStatus.PAID
    order.payment_reference = payment_reference
    order.status = Order.Status.PAID
    order.save()

    has_prescription = order.items.filter(prescription__isnull=False).exists()
    if has_prescription:
        order.status = Order.Status.PRESCRIPTION_REVIEW
        activity_action = 'PRESCRIPTION_REVIEW'
    else:
        order.status = Order.Status.FRAME_RESERVED
        activity_action = 'FRAME_RESERVED'
    order.save()

    OrderActivity.objects.create(
        order=order,
        actor=actor,
        action='PAID',
        metadata={'payment_reference': payment_reference}
    )

    OrderActivity.objects.create(
        order=order,
        actor=actor,
        action=activity_action,
        metadata={'low_stock_warnings': low_stock_warnings}
    )

    return order


# --- Order fulfillment state machine -----------------------------------------

# The forward-only path a paid order travels from production to delivery. Staff
# advance it stage by stage; a patient can confirm receipt (SHIPPED -> DELIVERED).
ORDER_FULFILLMENT_FLOW = [
    Order.Status.PAID,
    Order.Status.PRESCRIPTION_REVIEW,
    Order.Status.FRAME_RESERVED,
    Order.Status.IN_PRODUCTION,
    Order.Status.LENS_CUTTING,
    Order.Status.FRAME_ASSEMBLY,
    Order.Status.QUALITY_CHECK,
    Order.Status.READY_FOR_PICKUP,
    Order.Status.SHIPPED,
    Order.Status.DELIVERED,
]


@transaction.atomic
def order_update_status(*, order: Order, actor: User, new_status: str, notes: str = '') -> Order:
    """
    Move an order forward along the fulfillment flow, or cancel it.

    Rules:
      * Forward-only — a status can only advance to a later stage, never back.
      * CANCELLED is allowed from any stage that isn't already terminal
        (DELIVERED/CANCELLED).
      * Re-setting the current status is a no-op.

    Every change is recorded as an OrderActivity so the timeline stays truthful.
    """
    order = Order.objects.select_for_update().get(pk=order.pk)
    current = order.status

    if new_status == current:
        return order

    valid_targets = set(Order.Status.values)
    if new_status not in valid_targets:
        raise ValidationError(f"Unknown order status: {new_status}")

    if new_status == Order.Status.CANCELLED:
        if current in (Order.Status.DELIVERED, Order.Status.CANCELLED):
            raise ValidationError("A delivered or cancelled order cannot be cancelled.")
    else:
        if current not in ORDER_FULFILLMENT_FLOW or new_status not in ORDER_FULFILLMENT_FLOW:
            raise ValidationError(f"Cannot transition from {current} to {new_status}.")
        if ORDER_FULFILLMENT_FLOW.index(new_status) <= ORDER_FULFILLMENT_FLOW.index(current):
            raise ValidationError("Order status can only move forward.")

    order.status = new_status
    if notes:
        order.production_notes = notes
    order.save(update_fields=['status', 'production_notes', 'updated_at'])

    OrderActivity.objects.create(
        order=order,
        actor=actor,
        action=f'STATUS_{new_status}',
        metadata={'from': current, 'to': new_status, 'notes': notes or ''}
    )
    return order


# --- Glasses Builder: prescription-driven lens recommendation engine ---

from decimal import Decimal, InvalidOperation
from naderk.ecommerce.models import LensRecommendationRule


def _to_decimal(value):
    if value is None or value == '':
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def compute_prescription_metrics(values: dict) -> dict:
    """
    From raw builder prescription input, derive the per-metric value used by rules.
    SPH/CYL/ADD use the strongest (max absolute) of the two eyes; PD is a single value.
    Returns {metric: Decimal | None}.
    """
    def strongest(a, b):
        da, db = _to_decimal(a), _to_decimal(b)
        vals = [v for v in (da, db) if v is not None]
        if not vals:
            return None
        return max(vals, key=lambda v: abs(v))

    metrics = {
        'SPH': strongest(values.get('right_sph'), values.get('left_sph')),
        'CYL': strongest(values.get('right_cyl'), values.get('left_cyl')),
        'ADD': strongest(values.get('right_add'), values.get('left_add')),
        'PD':  _to_decimal(values.get('pupillary_distance')),
    }
    # Custom admin-defined fields (keyed by field_key), numeric ones become rule-testable
    extra = values.get('extra') or {}
    if isinstance(extra, dict):
        for key, val in extra.items():
            metrics[key] = _to_decimal(val)
    return metrics


def _rule_matches(rule: LensRecommendationRule, metric_value) -> bool:
    if metric_value is None:
        return False
    v = abs(metric_value) if rule.use_absolute else metric_value
    t = rule.threshold
    op = rule.operator
    if op == LensRecommendationRule.Operator.GTE:
        return v >= t
    if op == LensRecommendationRule.Operator.LTE:
        return v <= t
    if op == LensRecommendationRule.Operator.GT:
        return v > t
    if op == LensRecommendationRule.Operator.LT:
        return v < t
    if op == LensRecommendationRule.Operator.EQ:
        return v == t
    if op == LensRecommendationRule.Operator.BETWEEN:
        if rule.threshold_max is None:
            return False
        return t <= v <= rule.threshold_max
    return False


def evaluate_lens_recommendations(values: dict) -> dict:
    """
    Evaluate all active rules against the given prescription values.
    Returns the sets the client uses to highlight/restrict/hide lenses.
    """
    metrics = compute_prescription_metrics(values)

    recommended_types, recommended_options = set(), set()
    hidden_types, hidden_options = set(), set()
    restrict_types_matched, restrict_options_matched = set(), set()
    any_type_restrict = False
    any_option_restrict = False
    messages = []

    rules = (LensRecommendationRule.objects
             .filter(is_active=True)
             .prefetch_related('target_lens_types', 'target_lens_options'))

    for rule in rules:
        if not _rule_matches(rule, metrics.get(rule.metric)):
            continue

        type_ids = [str(t.id) for t in rule.target_lens_types.all()]
        option_ids = [str(o.id) for o in rule.target_lens_options.all()]

        if rule.action == LensRecommendationRule.Action.RECOMMEND:
            recommended_types.update(type_ids)
            recommended_options.update(option_ids)
        elif rule.action == LensRecommendationRule.Action.HIDE:
            hidden_types.update(type_ids)
            hidden_options.update(option_ids)
        elif rule.action == LensRecommendationRule.Action.RESTRICT:
            if type_ids:
                any_type_restrict = True
                restrict_types_matched.update(type_ids)
            if option_ids:
                any_option_restrict = True
                restrict_options_matched.update(option_ids)

        if rule.message:
            messages.append(rule.message)

    return {
        'metrics': {k: (str(v) if v is not None else None) for k, v in metrics.items()},
        'recommended_lens_type_ids': sorted(recommended_types),
        'recommended_lens_option_ids': sorted(recommended_options),
        'hidden_lens_type_ids': sorted(hidden_types),
        'hidden_lens_option_ids': sorted(hidden_options),
        # When any RESTRICT rule matched, only these ids are allowed (others disabled).
        'allowed_lens_type_ids': sorted(restrict_types_matched) if any_type_restrict else None,
        'allowed_lens_option_ids': sorted(restrict_options_matched) if any_option_restrict else None,
        'messages': messages,
    }


DEFAULT_BUILDER_FIELDS = [
    ('SPH', 'Sphere (SPH)', True, True, '-20', '20', 'Lens power for nearsighted/farsighted correction.'),
    ('CYL', 'Cylinder (CYL)', True, False, '-10', '10', 'Corrects astigmatism.'),
    ('AXIS', 'Axis', True, False, '0', '180', 'Orientation of the cylinder correction (0–180°).'),
    ('ADD', 'Addition (ADD)', True, False, '0', '4', 'Reading addition for progressive/bifocal lenses.'),
    ('PUPILLARY_DISTANCE', 'Pupillary Distance (PD)', True, True, '40', '80', 'Distance between pupils in mm.'),
    ('NEAR_PD', 'Near PD', False, False, '40', '80', 'Near pupillary distance.'),
    ('SEGMENT_HEIGHT', 'Segment Height', False, False, '0', '40', 'For bifocal/progressive fitting.'),
    ('FITTING_HEIGHT', 'Fitting Height', False, False, '0', '40', 'For progressive fitting.'),
]


def ensure_default_builder_fields():
    """Seed the default field config rows once (idempotent)."""
    from naderk.ecommerce.models import BuilderFieldConfig
    for order, (key, label, vis, req, mn, mx, help_text) in enumerate(DEFAULT_BUILDER_FIELDS):
        BuilderFieldConfig.objects.get_or_create(
            field_key=key,
            defaults={
                'label': label, 'is_visible': vis, 'is_required': req,
                'min_value': Decimal(mn), 'max_value': Decimal(mx),
                'help_text': help_text, 'order': order,
            },
        )
