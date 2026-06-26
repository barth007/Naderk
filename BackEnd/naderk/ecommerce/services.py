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
        lens_type = LensType.objects.get(id=lens_type_id)
        prescription = None
        if prescription_id:
            prescription = Prescription.objects.get(id=prescription_id)
            
        # Base Price
        price = frame_variant.frame.base_price + lens_type.price_modifier
        
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
