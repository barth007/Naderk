from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.utils import timezone
from .models import (
    StoreCategory, Product, ProductVariant, Frame, FrameVariant,
    LensType, FrameLensCompatibility, LensOption, Prescription,
    PrescriptionReview, PrescriptionActivity, Cart, CartItem,
    Wishlist, WishlistItem, Order, OrderItem, OrderActivity
)

User = get_user_model()

# --- Categories & General Products ---

class StoreCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = StoreCategory
        fields = ['id', 'name', 'slug', 'description', 'parent']


class ProductVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductVariant
        fields = ['id', 'product', 'variant_name', 'sku', 'quantity_available', 'low_stock_threshold', 'price_modifier', 'is_active']


class ProductSerializer(serializers.ModelSerializer):
    variants = ProductVariantSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True)
    category_slug = serializers.CharField(source='category.slug', read_only=True)
    sale_price = serializers.SerializerMethodField()
    flash_sale_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'slug', 'description', 'category', 'category_name', 'category_slug',
            'price', 'sale_price', 'flash_sale_name',
            'images', 'quantity_available', 'low_stock_threshold', 'is_active',
            'variants', 'created_at', 'updated_at'
        ]

    def _active_flash_sale(self, obj):
        from django.utils import timezone
        from naderk.ecommerce.models import FlashSale
        now = timezone.now()
        return (
            FlashSale.objects
            .filter(is_active=True, starts_at__lte=now, ends_at__gte=now, products=obj)
            .first()
        )

    def get_sale_price(self, obj):
        sale = self._active_flash_sale(obj)
        if sale:
            discounted = float(obj.price) * (1 - float(sale.discount_percent) / 100)
            return str(round(discounted, 2))
        return None

    def get_flash_sale_name(self, obj):
        sale = self._active_flash_sale(obj)
        return sale.name if sale else None


# --- Optical Configuration Entities ---

class FrameVariantSerializer(serializers.ModelSerializer):
    class Meta:
        model = FrameVariant
        fields = ['id', 'frame', 'color', 'size', 'quantity_available', 'low_stock_threshold', 'sku', 'is_active']


class FrameSerializer(serializers.ModelSerializer):
    variants = FrameVariantSerializer(many=True, read_only=True)
    gender_display = serializers.CharField(source='get_gender_display', read_only=True)
    rim_type_display = serializers.CharField(source='get_rim_type_display', read_only=True)
    size_category_display = serializers.CharField(source='get_size_category_display', read_only=True)

    class Meta:
        model = Frame
        fields = [
            'id', 'name', 'brand', 'style', 'material', 'base_price',
            'gender', 'gender_display', 'rim_type', 'rim_type_display',
            'size_category', 'size_category_display', 'description', 'features',
            'lens_width', 'bridge_width', 'temple_length', 'lens_height', 'total_width', 'weight_grams',
            'front_image', 'images', 'transparent_overlay_png', 'is_active', 'variants',
            'created_at', 'updated_at'
        ]


class LensTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = LensType
        fields = ['id', 'name', 'description', 'price_modifier', 'is_active']


class FrameLensCompatibilitySerializer(serializers.ModelSerializer):
    frame_name = serializers.CharField(source='frame.name', read_only=True)
    lens_type_name = serializers.CharField(source='lens_type.name', read_only=True)

    class Meta:
        model = FrameLensCompatibility
        fields = ['id', 'frame', 'frame_name', 'lens_type', 'lens_type_name']


class LensOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = LensOption
        fields = ['id', 'name', 'price_modifier', 'is_active']


# --- Prescriptions & Approval Workflow ---

class PrescriptionSerializer(serializers.ModelSerializer):
    patient_email = serializers.EmailField(source='patient.email', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_expired = serializers.SerializerMethodField()
    # Explicit overrides so empty-string and null are both accepted from the frontend
    prescription_file = serializers.URLField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = Prescription
        fields = [
            'id', 'patient', 'patient_email',
            'right_sph', 'right_cyl', 'right_axis', 'right_add',
            'left_sph', 'left_cyl', 'left_axis', 'left_add',
            'pupillary_distance', 'near_pd', 'segment_height', 'fitting_height',
            'extra_measurements',
            'prescription_file', 'status', 'status_display', 'expires_at', 'is_expired',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['patient', 'status', 'created_at', 'updated_at']

    def get_is_expired(self, obj) -> bool:
        if obj.expires_at:
            return obj.expires_at < timezone.now().date()
        return False

    def validate_right_axis(self, value):
        if value is not None and (value < 0 or value > 180):
            raise serializers.ValidationError("Axis value must be between 0 and 180 degrees.")
        return value

    def validate_left_axis(self, value):
        if value is not None and (value < 0 or value > 180):
            raise serializers.ValidationError("Axis value must be between 0 and 180 degrees.")
        return value

    def validate_pupillary_distance(self, value):
        if value < 40 or value > 80:
            raise serializers.ValidationError("Pupillary distance must be between 40 and 80 mm.")
        return value

    def validate_right_sph(self, value):
        if value is not None and (value < -20.00 or value > 20.00):
            raise serializers.ValidationError("SPH must be between -20.00 and +20.00.")
        return value

    def validate_left_sph(self, value):
        if value is not None and (value < -20.00 or value > 20.00):
            raise serializers.ValidationError("SPH must be between -20.00 and +20.00.")
        return value

    def validate_right_cyl(self, value):
        if value is not None and (value < -10.00 or value > 10.00):
            raise serializers.ValidationError("CYL must be between -10.00 and +10.00.")
        return value

    def validate_left_cyl(self, value):
        if value is not None and (value < -10.00 or value > 10.00):
            raise serializers.ValidationError("CYL must be between -10.00 and +10.00.")
        return value


class PrescriptionReviewSerializer(serializers.ModelSerializer):
    reviewed_by_email = serializers.EmailField(source='reviewed_by.email', read_only=True)

    class Meta:
        model = PrescriptionReview
        fields = ['id', 'prescription', 'reviewed_by', 'reviewed_by_email', 'review_notes', 'reviewed_at']


class PrescriptionActivitySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', read_only=True)

    class Meta:
        model = PrescriptionActivity
        fields = ['id', 'prescription', 'actor', 'actor_email', 'action', 'metadata', 'created_at']


# --- Carts, Wishlists & Orders ---

class CartItemSerializer(serializers.ModelSerializer):
    product_detail = ProductSerializer(source='product', read_only=True)
    product_variant_detail = ProductVariantSerializer(source='product_variant', read_only=True)
    frame_detail = FrameSerializer(source='frame_variant.frame', read_only=True)
    frame_variant_detail = FrameVariantSerializer(source='frame_variant', read_only=True)
    lens_type_detail = LensTypeSerializer(source='lens_type', read_only=True)
    lens_options_detail = LensOptionSerializer(source='lens_options', many=True, read_only=True)
    prescription_detail = PrescriptionSerializer(source='prescription', read_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id', 'cart', 'product', 'product_detail', 'product_variant', 'product_variant_detail',
            'frame_variant', 'frame_variant_detail', 'frame_detail', 'lens_type', 'lens_type_detail',
            'lens_options', 'lens_options_detail', 'prescription', 'prescription_detail',
            'price', 'quantity'
        ]


class AddToCartSerializer(serializers.Serializer):
    product_id = serializers.UUIDField(required=False, allow_null=True)
    product_variant_id = serializers.UUIDField(required=False, allow_null=True)
    frame_variant_id = serializers.UUIDField(required=False, allow_null=True)
    lens_type_id = serializers.UUIDField(required=False, allow_null=True)
    lens_option_ids = serializers.ListField(
        child=serializers.UUIDField(), required=False, default=list
    )
    prescription_id = serializers.UUIDField(required=False, allow_null=True)
    quantity = serializers.IntegerField(default=1, min_value=1)

    def validate(self, attrs):
        prod_id = attrs.get('product_id')
        frame_var_id = attrs.get('frame_variant_id')

        if not prod_id and not frame_var_id:
            raise serializers.ValidationError("Must provide either a Product or a Frame Variant.")

        if prod_id and frame_var_id:
            raise serializers.ValidationError("Cannot add both a Product and a Frame configuration in a single item.")

        if frame_var_id:
            # Configured eyewear requires lens type
            if not attrs.get('lens_type_id'):
                raise serializers.ValidationError("Lens type selection is required for prescription frames.")
            
            # If lens is prescription-based, ensure a prescription is attached.
            # Approval is NOT required at cart-add time — clinical review happens
            # after payment (order moves to PRESCRIPTION_REVIEW status).
            lens = LensType.objects.get(id=attrs.get('lens_type_id'))
            if lens.name.lower() != 'non-prescription':
                pres_id = attrs.get('prescription_id')
                if not pres_id:
                    raise serializers.ValidationError("A prescription is required for this lens type selection.")
                try:
                    pres = Prescription.objects.get(id=pres_id)
                    if pres.expires_at and pres.expires_at < timezone.now().date():
                        raise serializers.ValidationError("The selected prescription has expired.")
                except Prescription.DoesNotExist:
                    raise serializers.ValidationError("The selected prescription does not exist.")

            # Frame Lens compatibility check
            frame_var = FrameVariant.objects.get(id=frame_var_id)
            if not FrameLensCompatibility.objects.filter(frame=frame_var.frame, lens_type=lens).exists():
                raise serializers.ValidationError(f"The selected frame '{frame_var.frame.name}' is incompatible with the lens type '{lens.name}'.")

        return attrs


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    total_price = serializers.SerializerMethodField()

    class Meta:
        model = Cart
        fields = ['id', 'user', 'items', 'total_price', 'created_at', 'updated_at']

    def get_total_price(self, obj) -> float:
        total = 0
        for item in obj.items.all():
            total += item.price * item.quantity
        return float(total)


class WishlistItemSerializer(serializers.ModelSerializer):
    product_detail = ProductSerializer(source='product', read_only=True)
    frame_detail = FrameSerializer(source='frame_variant.frame', read_only=True)
    frame_variant_detail = FrameVariantSerializer(source='frame_variant', read_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'wishlist', 'product', 'product_detail', 'frame_variant', 'frame_variant_detail', 'created_at']


class WishlistSerializer(serializers.ModelSerializer):
    items = WishlistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Wishlist
        fields = ['id', 'user', 'items']


class OrderItemSerializer(serializers.ModelSerializer):
    product_detail = ProductSerializer(source='product', read_only=True)
    product_variant_detail = ProductVariantSerializer(source='product_variant', read_only=True)
    frame_detail = FrameSerializer(source='frame_variant.frame', read_only=True)
    frame_variant_detail = FrameVariantSerializer(source='frame_variant', read_only=True)
    lens_type_detail = LensTypeSerializer(source='lens_type', read_only=True)
    lens_options_detail = LensOptionSerializer(source='lens_options', many=True, read_only=True)

    class Meta:
        model = OrderItem
        fields = [
            'id', 'order', 'product', 'product_detail', 'product_variant', 'product_variant_detail',
            'frame_variant', 'frame_variant_detail', 'frame_detail', 'lens_type', 'lens_type_detail',
            'lens_options', 'lens_options_detail', 'prescription', 'prescription_snapshot',
            'price', 'quantity'
        ]


class OrderActivitySerializer(serializers.ModelSerializer):
    actor_email = serializers.EmailField(source='actor.email', read_only=True)

    class Meta:
        model = OrderActivity
        fields = ['id', 'order', 'actor', 'actor_email', 'action', 'metadata', 'created_at']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    activities = OrderActivitySerializer(many=True, read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    payment_status_display = serializers.CharField(source='get_payment_status_display', read_only=True)

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'status', 'status_display', 'payment_status', 'payment_status_display',
            'total_price', 'shipping_address', 'payment_reference', 'production_notes', 'internal_notes',
            'items', 'activities', 'created_at', 'updated_at'
        ]
        read_only_fields = ['user', 'status', 'payment_status', 'total_price', 'created_at', 'updated_at']


class CheckoutSerializer(serializers.Serializer):
    shipping_address = serializers.CharField(required=True)
    payment_reference = serializers.CharField(required=False, allow_blank=True, allow_null=True)


# --- Glasses Builder Configuration ---

from .models import BuilderFieldConfig, LensRecommendationRule


class BuilderFieldConfigSerializer(serializers.ModelSerializer):
    field_label = serializers.SerializerMethodField()

    class Meta:
        model = BuilderFieldConfig
        fields = [
            'id', 'field_key', 'field_label', 'label', 'is_custom', 'input_type',
            'select_options', 'is_visible', 'is_required',
            'min_value', 'max_value', 'help_text', 'order',
        ]
        read_only_fields = ['id', 'field_label', 'is_custom']

    def get_field_label(self, obj):
        # Built-in fields have a friendly enum label; custom fields use their label/key
        builtin = dict(BuilderFieldConfig.Field.choices)
        return builtin.get(obj.field_key) or obj.label or obj.field_key


class LensRecommendationRuleSerializer(serializers.ModelSerializer):
    metric_display = serializers.CharField(source='get_metric_display', read_only=True)
    operator_display = serializers.CharField(source='get_operator_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    target_lens_type_ids = serializers.PrimaryKeyRelatedField(
        source='target_lens_types', many=True, queryset=LensType.objects.all(), required=False
    )
    target_lens_option_ids = serializers.PrimaryKeyRelatedField(
        source='target_lens_options', many=True, queryset=LensOption.objects.all(), required=False
    )
    target_lens_type_names = serializers.SerializerMethodField()
    target_lens_option_names = serializers.SerializerMethodField()

    class Meta:
        model = LensRecommendationRule
        fields = [
            'id', 'name', 'metric', 'metric_display', 'operator', 'operator_display',
            'use_absolute', 'threshold', 'threshold_max', 'action', 'action_display',
            'target_lens_type_ids', 'target_lens_option_ids',
            'target_lens_type_names', 'target_lens_option_names',
            'message', 'priority', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_target_lens_type_names(self, obj):
        return [t.name for t in obj.target_lens_types.all()]

    def get_target_lens_option_names(self, obj):
        return [o.name for o in obj.target_lens_options.all()]

    def validate(self, attrs):
        op = attrs.get('operator', getattr(self.instance, 'operator', None))
        if op == LensRecommendationRule.Operator.BETWEEN and attrs.get('threshold_max') is None \
                and getattr(self.instance, 'threshold_max', None) is None:
            raise serializers.ValidationError({'threshold_max': 'Required when operator is "between".'})
        return attrs


class RecommendationRequestSerializer(serializers.Serializer):
    right_sph = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    right_cyl = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    right_add = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    left_sph = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    left_cyl = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    left_add = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    pupillary_distance = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    extra = serializers.DictField(required=False)


class BuilderFieldCreateSerializer(serializers.Serializer):
    label = serializers.CharField(max_length=120)
    input_type = serializers.ChoiceField(choices=BuilderFieldConfig.InputType.choices, default='NUMBER')
    select_options = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    is_required = serializers.BooleanField(default=False)
    min_value = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    max_value = serializers.DecimalField(max_digits=6, decimal_places=2, required=False, allow_null=True)
    help_text = serializers.CharField(max_length=255, required=False, allow_blank=True)
