import logging
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from typing import Optional, List
from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta

from .models import (
    StoreCategory, Product, ProductVariant, Frame, FrameVariant,
    LensType, FrameLensCompatibility, LensOption, Prescription,
    PrescriptionReview, PrescriptionActivity, Cart, CartItem,
    Wishlist, WishlistItem, Order, OrderItem, OrderActivity, FlashSale
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

# --- Pricing ------------------------------------------------------------------

def active_flash_sale(product: Product) -> Optional[FlashSale]:
    """The flash sale currently running for this product, if any."""
    now = timezone.now()
    return (
        FlashSale.objects
        .filter(is_active=True, starts_at__lte=now, ends_at__gte=now, products=product)
        .order_by('-discount_percent')
        .first()
    )


def product_sale_price(product: Product) -> Optional[Decimal]:
    """The discounted base price while a flash sale is running, else None."""
    sale = active_flash_sale(product)
    if sale is None:
        return None
    discounted = product.price * (Decimal('100') - sale.discount_percent) / Decimal('100')
    return discounted.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


def product_unit_price(product: Product, variant: Optional[ProductVariant] = None) -> Decimal:
    """
    What one unit costs right now. The single source for the price shown on the
    product (ProductSerializer.sale_price), put in the cart, and charged at
    checkout — a flash sale used to be exposed by the API but never charged.
    The discount applies to the base price; a variant's modifier is added after.
    """
    price = product_sale_price(product)
    if price is None:
        price = product.price
    if variant is not None:
        price += variant.price_modifier
    return price


def cart_item_unit_price(item: CartItem) -> Decimal:
    """Current unit price of a cart line, whichever kind of line it is."""
    if item.product_id:
        return product_unit_price(item.product, item.product_variant)
    price = item.frame_variant.frame.base_price
    if item.lens_type_id:
        price += item.lens_type.price_modifier
    return price + sum((opt.price_modifier for opt in item.lens_options.all()), Decimal('0'))


def cart_add_item(*, user: User, product_id: Optional[str] = None, product_variant_id: Optional[str] = None,
                  frame_variant_id: Optional[str] = None, lens_type_id: Optional[str] = None,
                  lens_option_ids: Optional[List[str]] = None, prescription_id: Optional[str] = None,
                  quantity: int = 1) -> CartItem:
    
    cart, _ = Cart.objects.get_or_create(user=user)
    
    if product_id:
        product = Product.objects.get(id=product_id)
        product_variant = None
        if product_variant_id:
            product_variant = ProductVariant.objects.get(id=product_variant_id, product=product)
        price = product_unit_price(product, product_variant)

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
            cart_item.price = price  # update to latest calculated price
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

# --- Stock ---------------------------------------------------------------------
#
# Stock is taken when the order is created and given back if the order is
# abandoned or cancelled. It used to be taken only once payment was confirmed,
# which meant the last unit could be sold to two people: the second one paid,
# the deduction failed, and they were left with a charge and a cancelled order.

def _stock_rows(order: Order):
    """
    (row, quantity, label) for every stock row the order draws on, each row
    locked for the rest of the transaction. Locked in a stable order so two
    checkouts over the same items cannot deadlock.
    """
    wanted = []
    for item in order.items.all():
        if item.product_variant_id:
            wanted.append((ProductVariant, item.product_variant_id, item.quantity))
        elif item.product_id:
            wanted.append((Product, item.product_id, item.quantity))
        elif item.frame_variant_id:
            wanted.append((FrameVariant, item.frame_variant_id, item.quantity))

    rows = []
    for model, pk, quantity in sorted(wanted, key=lambda w: (w[0].__name__, str(w[1]))):
        row = model.objects.select_for_update().get(pk=pk)
        if model is ProductVariant:
            label = f"{row.product.name} ({row.variant_name})"
        elif model is Product:
            label = row.name
        else:
            label = f"frame {row.frame.name} ({row.color}/{row.size})"
        rows.append((row, quantity, label))
    return rows


def _move_stock(row, delta: int) -> None:
    row.quantity_available += delta
    row.save(update_fields=['quantity_available'])
    if isinstance(row, ProductVariant):
        # Product.quantity_available is the total across a product's variants,
        # and is what the admin inventory page, its summary totals and the
        # product serializers read. F() so concurrent sales can't lose an update.
        Product.objects.filter(pk=row.product_id).update(
            quantity_available=F('quantity_available') + delta
        )


def order_reserve_stock(order: Order) -> None:
    """Take the order's items out of stock. Raises ValidationError if any is short."""
    if order.stock_reserved:
        return
    rows = _stock_rows(order)
    for row, quantity, label in rows:
        if row.quantity_available < quantity:
            raise ValidationError(f"Insufficient stock for {label}. Available: {row.quantity_available}")
    for row, quantity, _ in rows:
        _move_stock(row, -quantity)
    order.stock_reserved = True
    order.save(update_fields=['stock_reserved'])


def order_release_stock(order: Order) -> None:
    """Give the order's items back to stock. Safe to call more than once."""
    if not order.stock_reserved:
        return
    for row, quantity, _ in _stock_rows(order):
        _move_stock(row, quantity)
    order.stock_reserved = False
    order.save(update_fields=['stock_reserved'])


def _low_stock_warnings(order: Order) -> list:
    warnings = []
    for item in order.items.all():
        if item.product_variant_id:
            row, kind = item.product_variant, 'product_variant'
            name = f"{row.product.name} ({row.variant_name})"
        elif item.product_id:
            row, kind, name = item.product, 'product', item.product.name
        elif item.frame_variant_id:
            row, kind = item.frame_variant, 'frame_variant'
            name = f"{row.frame.name} ({row.color}/{row.size})"
        else:
            continue
        if row.quantity_available <= row.low_stock_threshold:
            warnings.append({'type': kind, 'id': str(row.id), 'name': name, 'remaining': row.quantity_available})
            logger.warning("Low stock warning: %s is at %s units.", name, row.quantity_available)
    return warnings


@transaction.atomic
def order_create_from_cart(*, user: User, shipping_address: str) -> Order:
    """
    Turn the cart into an unpaid order with its stock reserved.

    Atomic: if anything fails (expired prescription, short stock) no order is
    left behind and the cart is untouched.
    """
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
                
    # Price each line as of now, not as of when it went into the cart: a flash
    # sale may have started or ended, or the catalogue price changed, since.
    priced = [(item, cart_item_unit_price(item)) for item in cart_items]
    total_price = sum(price * item.quantity for item, price in priced)
    
    order = Order.objects.create(
        user=user,
        status=Order.Status.PENDING,
        payment_status=Order.PaymentStatus.UNPAID,
        total_price=total_price,
        shipping_address=shipping_address,
    )
    
    # Create OrderItems & Snapshots
    for item, price in priced:
        order_item = OrderItem.objects.create(
            order=order,
            product=item.product,
            product_variant=item.product_variant,
            frame_variant=item.frame_variant,
            lens_type=item.lens_type,
            prescription=item.prescription,
            price=price,
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

    order_reserve_stock(order)

    OrderActivity.objects.create(
        order=order,
        actor=user,
        action='CREATED'
    )

    # Clear cart
    cart_items.delete()
    return order

@transaction.atomic
def order_process_payment(*, order: Order, actor: User, payment_reference: str) -> Order:
    """
    Apply a confirmed payment to an order. Idempotent.

    The caller must already have verified the payment with the provider and
    checked its amount — see payments.services.confirm_and_fulfill, the only
    place this should be reached from outside tests.
    """
    # Lock the row so concurrent webhook retries can't both pass the PAID check
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.payment_status == Order.PaymentStatus.PAID:
        return order

    order.payment_status = Order.PaymentStatus.PAID
    order.payment_reference = payment_reference

    # Normally the stock was reserved at checkout. It is not when the order was
    # created before reservation existed, or when the abandoned-order sweeper
    # already released it and the payment arrived afterwards.
    if not order.stock_reserved:
        try:
            with transaction.atomic():
                order_reserve_stock(order)
        except ValidationError as e:
            # The money has moved, so record that rather than pretending the
            # payment failed, and leave the order for staff to refund.
            order.save(update_fields=['payment_status', 'payment_reference', 'updated_at'])
            OrderActivity.objects.create(
                order=order, actor=actor, action='PAYMENT_NEEDS_REFUND',
                metadata={'payment_reference': payment_reference, 'reason': '; '.join(e.messages)},
            )
            logger.error("Order %s was paid (%s) but its stock is gone: %s",
                         order.id, payment_reference, '; '.join(e.messages))
            return order

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
        metadata={'low_stock_warnings': _low_stock_warnings(order)}
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

    if new_status == Order.Status.CANCELLED:
        order_release_stock(order)

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
