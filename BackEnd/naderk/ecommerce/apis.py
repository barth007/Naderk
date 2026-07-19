from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.shortcuts import get_object_or_404
from django.http import Http404

from naderk.common.responses.builders import build_success_response, build_error_response
from .models import (
    StoreCategory, Product, Frame, LensType, LensOption,
    Prescription, CartItem, Order, WishlistItem
)
from .serializers import (
    StoreCategorySerializer, ProductSerializer, FrameSerializer,
    LensTypeSerializer, LensOptionSerializer, PrescriptionSerializer,
    PrescriptionReviewSerializer, CartSerializer, AddToCartSerializer,
    WishlistSerializer, OrderSerializer, CheckoutSerializer
)
from .selectors import (
    get_active_categories, get_products, get_frames, get_lens_types,
    get_lens_options, get_prescriptions_for_optician, get_prescriptions_for_patient,
    get_user_cart, get_user_wishlist, get_user_orders
)
from .services import (
    prescription_create, prescription_assign_for_review, prescription_review_complete,
    cart_add_item, cart_update_item_quantity, cart_remove_item, cart_clear,
    wishlist_toggle_item, order_create_from_cart, order_process_payment
)

class CategoryListApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        categories = get_active_categories()
        serializer = StoreCategorySerializer(categories, many=True)
        return build_success_response("Categories retrieved successfully", serializer.data)


class ProductListApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        category_slug = request.query_params.get('category_slug')
        search_query = request.query_params.get('search')
        sort_by = request.query_params.get('sort_by')
        
        products = get_products(
            category_slug=category_slug,
            search_query=search_query,
            sort_by=sort_by
        )
        serializer = ProductSerializer(products, many=True)
        return build_success_response("Products retrieved successfully", serializer.data)


class ProductDetailApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, pk):
        try:
            product = Product.objects.prefetch_related('variants').get(id=pk, is_active=True)
            serializer = ProductSerializer(product)
            return build_success_response("Product details retrieved successfully", serializer.data)
        except Product.DoesNotExist:
            return build_error_response(
                type_uri=_problems_url('not-found'),
                title="Not Found",
                status_code=404,
                detail="Product not found",
                instance=request.path
            )


class FrameListApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        search_query = request.query_params.get('search')
        brand = request.query_params.get('brand')
        frames = get_frames(search_query=search_query, brand=brand)
        serializer = FrameSerializer(frames, many=True)
        return build_success_response("Frames retrieved successfully", serializer.data)


class FrameDetailApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request, pk):
        try:
            frame = Frame.objects.prefetch_related('variants').get(id=pk, is_active=True)
            serializer = FrameSerializer(frame)
            return build_success_response("Frame details retrieved successfully", serializer.data)
        except Frame.DoesNotExist:
            return build_error_response(
                type_uri=_problems_url('not-found'),
                title="Not Found",
                status_code=404,
                detail="Frame not found",
                instance=request.path
            )


class LensTypeListApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        lens_types = get_lens_types()
        serializer = LensTypeSerializer(lens_types, many=True)
        return build_success_response("Lens types retrieved successfully", serializer.data)


class LensOptionListApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        lens_options = get_lens_options()
        serializer = LensOptionSerializer(lens_options, many=True)
        return build_success_response("Lens options retrieved successfully", serializer.data)


class PrescriptionListCreateApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        if patient_id and (request.user.is_staff or request.user.role in ['ADMIN', 'DOCTOR', 'AGENT', 'MEDICAL_AGENT']):
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                patient = User.objects.get(id=patient_id, role=User.Role.PATIENT)
                prescriptions = Prescription.objects.filter(patient=patient)
            except User.DoesNotExist:
                prescriptions = Prescription.objects.none()
        else:
            prescriptions = get_prescriptions_for_patient(request.user)
        serializer = PrescriptionSerializer(prescriptions, many=True)
        return build_success_response("Prescriptions retrieved successfully", serializer.data)
        
    def post(self, request):
        serializer = PrescriptionSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail="Prescription validation failed",
                instance=request.path,
                errors=serializer.errors
            )
            
        target_patient = request.user
        if request.user.is_staff or getattr(request.user, 'role', None) in ['ADMIN', 'DOCTOR', 'AGENT', 'MEDICAL_AGENT']:
            patient_id = request.data.get('patient_id')
            if patient_id:
                from django.contrib.auth import get_user_model
                User = get_user_model()
                try:
                    target_patient = User.objects.get(id=patient_id, role=User.Role.PATIENT)
                except User.DoesNotExist:
                    return build_error_response(
                        type_uri=_problems_url('not-found'),
                        title="Not Found",
                        status_code=404,
                        detail="Patient not found",
                        instance=request.path
                    )
            # If no patient_id provided, fall back to creating for request.user themselves
            # (staff testing the optical builder flow for themselves)

        try:
            prescription = prescription_create(
                patient=target_patient,
                **serializer.validated_data
            )
            
            # Clinicians/Doctors can auto-approve prescriptions they write directly
            if request.user.role == 'DOCTOR':
                from django.utils import timezone
                from .models import PrescriptionReview
                prescription.status = Prescription.Status.APPROVED
                prescription.save(update_fields=['status'])
                PrescriptionReview.objects.create(
                    prescription=prescription,
                    reviewed_by=request.user,
                    review_notes="Auto-approved by prescribing clinician",
                    reviewed_at=timezone.now()
                )

            res_serializer = PrescriptionSerializer(prescription)
            return build_success_response("Prescription submitted", res_serializer.data, status_code=201)
        except (DjangoValidationError, DRFValidationError) as e:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path
            )


class PrescriptionReusableListApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        from django.utils import timezone
        from django.db.models import Q
        prescriptions = get_prescriptions_for_patient(request.user).filter(
            status=Prescription.Status.APPROVED
        )
        today = timezone.now().date()
        prescriptions = prescriptions.filter(
            Q(expires_at__isnull=True) | Q(expires_at__gte=today),
            created_at__gte=timezone.now() - timezone.timedelta(days=365)
        )
        serializer = PrescriptionSerializer(prescriptions, many=True)
        return build_success_response("Reusable prescriptions retrieved successfully", serializer.data)


class PrescriptionDetailApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            # Patients can only see their own prescriptions, staff can see all
            if request.user.is_staff or request.user.role in ['ADMIN', 'DOCTOR']:
                prescription = Prescription.objects.get(id=pk)
            else:
                prescription = Prescription.objects.get(id=pk, patient=request.user)
                
            serializer = PrescriptionSerializer(prescription)
            return build_success_response("Prescription retrieved successfully", serializer.data)
        except Prescription.DoesNotExist:
            return build_error_response(
                type_uri=_problems_url('not-found'),
                title="Not Found",
                status_code=404,
                detail="Prescription not found",
                instance=request.path
            )


class PrescriptionReviewQueueApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        if not request.user.is_staff and request.user.role not in ['ADMIN', 'DOCTOR']:
            return build_error_response(
                type_uri=_problems_url('forbidden'),
                title="Forbidden",
                status_code=403,
                detail="Only staff, doctors, or administrators can view the review queue",
                instance=request.path
            )
            
        queue = get_prescriptions_for_optician()
        serializer = PrescriptionSerializer(queue, many=True)
        return build_success_response("Review queue retrieved successfully", serializer.data)


class PrescriptionReviewActionApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        if not request.user.is_staff and request.user.role not in ['ADMIN', 'DOCTOR']:
            return build_error_response(
                type_uri=_problems_url('forbidden'),
                title="Forbidden",
                status_code=403,
                detail="Only staff, doctors, or administrators can review prescriptions",
                instance=request.path
            )
            
        try:
            prescription = Prescription.objects.get(id=pk)
        except Prescription.DoesNotExist:
            return build_error_response(
                type_uri=_problems_url('not-found'),
                title="Not Found",
                status_code=404,
                detail="Prescription not found",
                instance=request.path
            )
            
        status = request.data.get('status')
        review_notes = request.data.get('review_notes')
        
        if not status:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail="Review status is required",
                instance=request.path
            )
            
        try:
            if status == Prescription.Status.UNDER_REVIEW:
                prescription = prescription_assign_for_review(prescription=prescription, optician=request.user)
            else:
                prescription = prescription_review_complete(
                    prescription=prescription,
                    optician=request.user,
                    status=status,
                    review_notes=review_notes
                )
            serializer = PrescriptionSerializer(prescription)
            return build_success_response("Prescription review updated successfully", serializer.data)
        except (DjangoValidationError, DRFValidationError) as e:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path
            )


class CartDetailApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        cart = get_user_cart(request.user)
        serializer = CartSerializer(cart)
        return build_success_response("Cart details retrieved successfully", serializer.data)


class CartAddItemApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = AddToCartSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail="Invalid fields for cart addition",
                instance=request.path,
                errors=serializer.errors
            )
            
        try:
            cart_item = cart_add_item(
                user=request.user,
                product_id=serializer.validated_data.get('product_id'),
                product_variant_id=serializer.validated_data.get('product_variant_id'),
                frame_variant_id=serializer.validated_data.get('frame_variant_id'),
                lens_type_id=serializer.validated_data.get('lens_type_id'),
                lens_option_ids=serializer.validated_data.get('lens_option_ids'),
                prescription_id=serializer.validated_data.get('prescription_id'),
                quantity=serializer.validated_data.get('quantity', 1)
            )
            cart = get_user_cart(request.user)
            return build_success_response("Item added to cart successfully", CartSerializer(cart).data)
        except (DjangoValidationError, DRFValidationError) as e:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path
            )


class CartUpdateQuantityApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        item_id = request.data.get('item_id')
        quantity = request.data.get('quantity')
        
        if not item_id or quantity is None:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail="item_id and quantity are required parameters",
                instance=request.path
            )
            
        try:
            cart_item = cart_update_item_quantity(
                user=request.user,
                item_id=item_id,
                quantity=int(quantity)
            )
            cart = get_user_cart(request.user)
            return build_success_response("Cart item quantity updated successfully", CartSerializer(cart).data)
        except (DjangoValidationError, DRFValidationError) as e:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path
            )


class CartRemoveItemApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        item_id = request.data.get('item_id')
        if not item_id:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail="item_id is required to remove an item",
                instance=request.path
            )
            
        cart_remove_item(user=request.user, item_id=item_id)
        cart = get_user_cart(request.user)
        return build_success_response("Item removed from cart successfully", CartSerializer(cart).data)


class CartClearApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        cart_clear(user=request.user)
        cart = get_user_cart(request.user)
        return build_success_response("Cart cleared successfully", CartSerializer(cart).data)


class WishlistDetailApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        wishlist = get_user_wishlist(request.user)
        serializer = WishlistSerializer(wishlist)
        return build_success_response("Wishlist details retrieved successfully", serializer.data)


class WishlistToggleItemApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        product_id = request.data.get('product_id')
        frame_variant_id = request.data.get('frame_variant_id')
        
        try:
            item, added = wishlist_toggle_item(
                user=request.user,
                product_id=product_id,
                frame_variant_id=frame_variant_id
            )
            message = "Item added to wishlist" if added else "Item removed from wishlist"
            wishlist = get_user_wishlist(request.user)
            return build_success_response(message, WishlistSerializer(wishlist).data)
        except (DjangoValidationError, DRFValidationError) as e:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path
            )


class CheckoutApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = CheckoutSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail="Checkout validation failed",
                instance=request.path,
                errors=serializer.errors
            )
            
        try:
            order = order_create_from_cart(
                user=request.user,
                shipping_address=serializer.validated_data.get('shipping_address'),
                payment_reference=serializer.validated_data.get('payment_reference')
            )
            return build_success_response(
                "Order created and processed successfully",
                OrderSerializer(order).data,
                status_code=201
            )
        except (DjangoValidationError, DRFValidationError) as e:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path
            )


class OrderListApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        orders = get_user_orders(request.user)
        serializer = OrderSerializer(orders, many=True)
        return build_success_response("Orders retrieved successfully", serializer.data)


class OrderDetailApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            order = Order.objects.prefetch_related('items', 'activities').get(id=pk)
            # Users can see their own orders, staff/admin/doctors can see all
            if not request.user.is_staff and request.user.role not in ['ADMIN', 'DOCTOR'] and order.user != request.user:
                return build_error_response(
                    type_uri=_problems_url('forbidden'),
                    title="Forbidden",
                    status_code=403,
                    detail="You do not have permission to view this order",
                    instance=request.path
                )
            serializer = OrderSerializer(order)
            return build_success_response("Order details retrieved successfully", serializer.data)
        except Order.DoesNotExist:
            return build_error_response(
                type_uri=_problems_url('not-found'),
                title="Not Found",
                status_code=404,
                detail="Order not found",
                instance=request.path
            )


class OrderPaymentApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        payment_reference = request.data.get('payment_reference')
        if not payment_reference:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail="payment_reference is required",
                instance=request.path
            )
            
        try:
            order = Order.objects.get(id=pk)
            if not request.user.is_staff and request.user.role not in ['ADMIN', 'DOCTOR'] and order.user != request.user:
                return build_error_response(
                    type_uri=_problems_url('forbidden'),
                    title="Forbidden",
                    status_code=403,
                    detail="You do not have permission to process payment for this order",
                    instance=request.path
                )
                
            order = order_process_payment(
                order=order,
                actor=request.user,
                payment_reference=payment_reference
            )
            return build_success_response("Payment completed successfully", OrderSerializer(order).data)
        except Order.DoesNotExist:
            return build_error_response(
                type_uri=_problems_url('not-found'),
                title="Not Found",
                status_code=404,
                detail="Order not found",
                instance=request.path
            )
        except (DjangoValidationError, DRFValidationError) as e:
            return build_error_response(
                type_uri=_problems_url('validation-error'),
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path
            )


STAFF_ROLES = {'ADMIN', 'SUPER_ADMIN', 'DOCTOR', 'AGENT'}


class OrderReviewQueueApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if getattr(request.user, 'role', None) not in STAFF_ROLES:
            return build_error_response("forbidden", "Access denied", 403, "Staff only.")
        orders = (
            Order.objects
            .filter(status=Order.Status.PRESCRIPTION_REVIEW)
            .select_related('user')
            .prefetch_related('items__prescription', 'activities')
            .order_by('created_at')
        )
        return build_success_response("Review queue", OrderSerializer(orders, many=True).data)


class OrderPrescriptionReviewApi(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if getattr(request.user, 'role', None) not in STAFF_ROLES:
            return build_error_response("forbidden", "Access denied", 403, "Staff only.")
        try:
            order = Order.objects.get(id=pk)
        except Order.DoesNotExist:
            return build_error_response("not-found", "Order not found", 404, "Invalid order ID.")
        if order.status != Order.Status.PRESCRIPTION_REVIEW:
            return build_error_response("invalid-state", "Not in review", 400, "Order is not awaiting prescription review.")
        action = request.data.get('action')
        notes = request.data.get('notes', '')
        if action == 'approve':
            order.status = Order.Status.FRAME_RESERVED
            order_action = 'FRAME_RESERVED'
        elif action == 'reject':
            order.status = Order.Status.CANCELLED
            order_action = 'CANCELLED'
        else:
            return build_error_response("validation-error", "Invalid action", 400, "action must be 'approve' or 'reject'.")
        if notes:
            order.internal_notes = notes
        order.save()
        from .models import OrderActivity
        OrderActivity.objects.create(
            order=order,
            actor=request.user,
            action=order_action,
            metadata={'reviewed_by': str(request.user.id), 'notes': notes}
        )
        return build_success_response("Order review complete", OrderSerializer(order).data)
