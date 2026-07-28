import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

# --- Categories & General Products ---

class StoreCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True, null=True)
    parent = models.ForeignKey(
        'self', 
        on_delete=models.CASCADE, 
        related_name='children', 
        blank=True, 
        null=True
    )

    class Meta:
        verbose_name = _("Store Category")
        verbose_name_plural = _("Store Categories")

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} -> {self.name}"
        return self.name


class Product(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField()
    category = models.ForeignKey(
        StoreCategory, 
        on_delete=models.PROTECT, 
        related_name='products'
    )
    price = models.DecimalField(max_digits=12, decimal_places=2)
    images = models.JSONField(default=list, blank=True)  # List of Cloudinary image URLs
    quantity_available = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class ProductVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        related_name='variants'
    )
    variant_name = models.CharField(max_length=255)  # e.g., "30 Capsules" or "60 Capsules"
    sku = models.CharField(max_length=255, unique=True, blank=True, null=True)
    quantity_available = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=5)
    price_modifier = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.product.name} ({self.variant_name})"


# --- Optical Configuration Entities ---

class Frame(models.Model):
    class Gender(models.TextChoices):
        MEN = 'MEN', 'Men'
        WOMEN = 'WOMEN', 'Women'
        UNISEX = 'UNISEX', 'Unisex'
        KIDS = 'KIDS', 'Kids'

    class RimType(models.TextChoices):
        FULL_RIM = 'FULL_RIM', 'Full Rim'
        SEMI_RIMLESS = 'SEMI_RIMLESS', 'Semi-Rimless'
        RIMLESS = 'RIMLESS', 'Rimless'

    class SizeCategory(models.TextChoices):
        NARROW = 'NARROW', 'Narrow'
        MEDIUM = 'MEDIUM', 'Medium'
        WIDE = 'WIDE', 'Wide'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=255)
    style = models.CharField(max_length=255)  # Shape: Wayfarer, Aviator, Round, Rectangle, Cat-Eye…
    material = models.CharField(max_length=255)  # e.g. Acetate, Metal, Titanium, Plastic
    base_price = models.DecimalField(max_digits=12, decimal_places=2)

    # Merchandising sections
    gender = models.CharField(max_length=10, choices=Gender.choices, default=Gender.UNISEX)
    rim_type = models.CharField(max_length=15, choices=RimType.choices, default=RimType.FULL_RIM)
    size_category = models.CharField(max_length=10, choices=SizeCategory.choices, default=SizeCategory.MEDIUM)
    description = models.TextField(blank=True)
    features = models.TextField(blank=True, help_text="e.g. Spring hinges, Adjustable nose pads (comma-separated)")

    # Standard frame measurements (millimetres) — the "lens □ bridge – temple" spec
    lens_width = models.PositiveIntegerField(null=True, blank=True, help_text="Lens width (eye size), mm")
    bridge_width = models.PositiveIntegerField(null=True, blank=True, help_text="Bridge / nose width, mm")
    temple_length = models.PositiveIntegerField(null=True, blank=True, help_text="Temple (arm) length, mm")
    lens_height = models.PositiveIntegerField(null=True, blank=True, help_text="Lens height, mm")
    total_width = models.PositiveIntegerField(null=True, blank=True, help_text="Total frame width, mm")
    weight_grams = models.PositiveIntegerField(null=True, blank=True, help_text="Frame weight, grams")

    front_image = models.URLField(max_length=1000, blank=True, null=True)  # Primary image (= images[0])
    images = models.JSONField(default=list, blank=True)  # Up to 4 view URLs (front, side, angle, detail)
    transparent_overlay_png = models.URLField(max_length=1000, blank=True, null=True)  # Future Try-On overlay
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.brand} - {self.name}"


class FrameVariant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    frame = models.ForeignKey(
        Frame, 
        on_delete=models.CASCADE, 
        related_name='variants'
    )
    color = models.CharField(max_length=255)
    size = models.CharField(max_length=255)  # e.g. Small, Medium, Large
    quantity_available = models.IntegerField(default=0)
    low_stock_threshold = models.IntegerField(default=3)
    sku = models.CharField(max_length=255, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.frame.brand} {self.frame.name} ({self.color} / {self.size})"


class LensType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)  # e.g. Single Vision, Bifocal, Progressive, Non-Prescription
    description = models.TextField()
    price_modifier = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class FrameLensCompatibility(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    frame = models.ForeignKey(Frame, on_delete=models.CASCADE, related_name='compatibilities')
    lens_type = models.ForeignKey(LensType, on_delete=models.CASCADE, related_name='compatibilities')

    class Meta:
        unique_together = ('frame', 'lens_type')
        verbose_name_plural = _("Frame Lens Compatibilities")

    def __str__(self):
        return f"{self.frame.name} <=> {self.lens_type.name}"


class LensOption(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)  # e.g. Anti-Reflective, Blue Light Filter, Transitions
    price_modifier = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


# --- Prescriptions & Approval Workflow ---

class Prescription(models.Model):
    class Status(models.TextChoices):
        PENDING_REVIEW = 'PENDING_REVIEW', _('Pending Review')
        UNDER_REVIEW = 'UNDER_REVIEW', _('Under Review')
        APPROVED = 'APPROVED', _('Approved')
        REQUIRES_CORRECTION = 'REQUIRES_CORRECTION', _('Requires Correction')
        REJECTED = 'REJECTED', _('Rejected')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='prescriptions'
    )
    encounter = models.ForeignKey(
        'medical_records.ConsultationEncounter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='eyewear_prescriptions'
    )
    
    # Right Eye (OD)
    right_sph = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    right_cyl = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    right_axis = models.IntegerField(blank=True, null=True)
    right_add = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    
    # Left Eye (OS)
    left_sph = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    left_cyl = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    left_axis = models.IntegerField(blank=True, null=True)
    left_add = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    
    # Pupillary Distance (Required)
    pupillary_distance = models.DecimalField(max_digits=5, decimal_places=2)
    
    # Extensible Optional Measurements
    near_pd = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    segment_height = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)
    fitting_height = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)

    # Admin-defined custom prescription fields: {field_key: value}
    extra_measurements = models.JSONField(default=dict, blank=True)
    
    prescription_file = models.URLField(max_length=1000, blank=True, null=True)  # Cloudinary file URL
    status = models.CharField(
        max_length=50, 
        choices=Status.choices, 
        default=Status.PENDING_REVIEW
    )
    expires_at = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Prescription for {self.patient.email} ({self.get_status_display()})"


class PrescriptionReview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.OneToOneField(
        Prescription, 
        on_delete=models.CASCADE, 
        related_name='review'
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        blank=True, 
        null=True, 
        related_name='prescription_reviews'
    )
    review_notes = models.TextField(blank=True, null=True)
    reviewed_at = models.DateTimeField(blank=True, null=True)

    def __str__(self):
        return f"Review of Prescription {self.prescription.id}"


class PrescriptionActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription = models.ForeignKey(
        Prescription, 
        on_delete=models.CASCADE, 
        related_name='activities'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        blank=True, 
        null=True
    )
    action = models.CharField(max_length=255)  # e.g., CREATED, SUBMITTED, APPROVED
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = _("Prescription Activities")


# --- Carts, Wishlists & Orders ---

class Cart(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='cart'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Cart for {self.user.email}"


class CartItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cart = models.ForeignKey(
        Cart, 
        on_delete=models.CASCADE, 
        related_name='items'
    )
    # Standard Marketplace Product
    product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        blank=True, 
        null=True
    )
    product_variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.CASCADE,
        blank=True,
        null=True
    )
    # Eyewear Configuration fields
    frame_variant = models.ForeignKey(
        FrameVariant, 
        on_delete=models.CASCADE, 
        blank=True, 
        null=True
    )
    lens_type = models.ForeignKey(
        LensType, 
        on_delete=models.CASCADE, 
        blank=True, 
        null=True
    )
    lens_options = models.ManyToManyField(
        LensOption, 
        blank=True
    )
    prescription = models.ForeignKey(
        Prescription, 
        on_delete=models.SET_NULL, 
        blank=True, 
        null=True
    )
    
    price = models.DecimalField(max_digits=12, decimal_places=2)  # Unit price at time of adding
    quantity = models.IntegerField(default=1)

    def __str__(self):
        if self.product:
            return f"CartItem: {self.product.name} (x{self.quantity})"
        elif self.frame_variant:
            return f"CartItem: Configured Glasses {self.frame_variant.frame.name} (x{self.quantity})"
        return f"CartItem {self.id}"


class Wishlist(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='wishlist'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Wishlist for {self.user.email}"


class WishlistItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    wishlist = models.ForeignKey(
        Wishlist, 
        on_delete=models.CASCADE, 
        related_name='items'
    )
    product = models.ForeignKey(
        Product, 
        on_delete=models.CASCADE, 
        blank=True, 
        null=True
    )
    frame_variant = models.ForeignKey(
        FrameVariant, 
        on_delete=models.CASCADE, 
        blank=True, 
        null=True
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (('wishlist', 'product'), ('wishlist', 'frame_variant'))

    def __str__(self):
        if self.product:
            return f"WishlistItem: {self.product.name}"
        elif self.frame_variant:
            return f"WishlistItem: Frame {self.frame_variant.frame.name}"
        return f"WishlistItem {self.id}"


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDING', _('Pending')
        PAID = 'PAID', _('Paid')
        PRESCRIPTION_REVIEW = 'PRESCRIPTION_REVIEW', _('Prescription Review')
        FRAME_RESERVED = 'FRAME_RESERVED', _('Frame Reserved')
        IN_PRODUCTION = 'IN_PRODUCTION', _('In Production')
        LENS_CUTTING = 'LENS_CUTTING', _('Lens Cutting')
        FRAME_ASSEMBLY = 'FRAME_ASSEMBLY', _('Frame Assembly')
        QUALITY_CHECK = 'QUALITY_CHECK', _('Quality Check')
        READY_FOR_PICKUP = 'READY_FOR_PICKUP', _('Ready For Pickup')
        SHIPPED = 'SHIPPED', _('Shipped')
        DELIVERED = 'DELIVERED', _('Delivered')
        CANCELLED = 'CANCELLED', _('Cancelled')

    class PaymentStatus(models.TextChoices):
        UNPAID = 'UNPAID', _('Unpaid')
        PENDING_PAYMENT = 'PENDING_PAYMENT', _('Pending Payment')
        PAID = 'PAID', _('Paid')
        FAILED = 'FAILED', _('Failed')
        REFUNDED = 'REFUNDED', _('Refunded')
        PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED', _('Partially Refunded')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.PROTECT, 
        related_name='orders'
    )
    status = models.CharField(
        max_length=50, 
        choices=Status.choices, 
        default=Status.PENDING
    )
    payment_status = models.CharField(
        max_length=50, 
        choices=PaymentStatus.choices, 
        default=PaymentStatus.UNPAID
    )
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_address = models.TextField()
    payment_reference = models.CharField(max_length=255, blank=True, null=True)
    production_notes = models.TextField(blank=True, null=True)  # Staff only
    internal_notes = models.TextField(blank=True, null=True)    # Staff only
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Order {self.id} ({self.get_status_display()})"


class OrderItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order, 
        on_delete=models.CASCADE, 
        related_name='items'
    )
    product = models.ForeignKey(
        Product, 
        on_delete=models.PROTECT, 
        blank=True, 
        null=True
    )
    product_variant = models.ForeignKey(
        ProductVariant,
        on_delete=models.PROTECT,
        blank=True,
        null=True
    )
    frame_variant = models.ForeignKey(
        FrameVariant, 
        on_delete=models.PROTECT, 
        blank=True, 
        null=True
    )
    lens_type = models.ForeignKey(
        LensType, 
        on_delete=models.PROTECT, 
        blank=True, 
        null=True
    )
    lens_options = models.ManyToManyField(
        LensOption, 
        blank=True
    )
    prescription = models.ForeignKey(
        Prescription, 
        on_delete=models.SET_NULL, 
        blank=True, 
        null=True
    )
    # Snapshot of the prescription values at the exact time of order placement
    prescription_snapshot = models.JSONField(blank=True, null=True)
    
    price = models.DecimalField(max_digits=12, decimal_places=2)
    quantity = models.IntegerField(default=1)

    def __str__(self):
        if self.product:
            return f"OrderItem: {self.product.name} (x{self.quantity})"
        elif self.frame_variant:
            return f"OrderItem: Configured Glasses {self.frame_variant.frame.name} (x{self.quantity})"
        return f"OrderItem {self.id}"


class OrderActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    order = models.ForeignKey(
        Order, 
        on_delete=models.CASCADE, 
        related_name='activities'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        blank=True, 
        null=True
    )
    action = models.CharField(max_length=255)  # e.g., CREATED, PAID, FRAME_RESERVED, LENS_CUTTING_STARTED
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = _("Order Activities")


class FlashSale(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    products = models.ManyToManyField(Product, related_name='flash_sales', blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name = _("Flash Sale")
        verbose_name_plural = _("Flash Sales")


# --- Glasses Builder Configuration (admin-driven) ---

class BuilderFieldConfig(models.Model):
    """
    Controls which prescription fields the patient-facing Glasses Builder collects,
    whether they are required, and their allowed value ranges. Configured by admins.
    """
    class Field(models.TextChoices):
        SPH = 'SPH', _('Sphere (SPH)')
        CYL = 'CYL', _('Cylinder (CYL)')
        AXIS = 'AXIS', _('Axis')
        ADD = 'ADD', _('Addition (ADD)')
        PUPILLARY_DISTANCE = 'PUPILLARY_DISTANCE', _('Pupillary Distance (PD)')
        NEAR_PD = 'NEAR_PD', _('Near PD')
        SEGMENT_HEIGHT = 'SEGMENT_HEIGHT', _('Segment Height')
        FITTING_HEIGHT = 'FITTING_HEIGHT', _('Fitting Height')

    class InputType(models.TextChoices):
        NUMBER = 'NUMBER', _('Number')
        TEXT = 'TEXT', _('Text')
        SELECT = 'SELECT', _('Dropdown')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Not restricted to the built-in choices — admins can add custom field keys.
    field_key = models.CharField(max_length=60, unique=True)
    label = models.CharField(max_length=120, blank=True)
    is_custom = models.BooleanField(default=False)
    input_type = models.CharField(max_length=10, choices=InputType.choices, default=InputType.NUMBER)
    select_options = models.JSONField(default=list, blank=True, help_text=_('Choices for a dropdown field.'))
    is_visible = models.BooleanField(default=True)
    is_required = models.BooleanField(default=False)
    min_value = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    max_value = models.DecimalField(max_digits=6, decimal_places=2, blank=True, null=True)
    help_text = models.CharField(max_length=255, blank=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'field_key']

    def __str__(self):
        return self.field_key


class LensRecommendationRule(models.Model):
    """
    Admin-defined rule: when a prescription metric crosses a threshold, apply an
    action (recommend / restrict / hide) to a set of lens types and/or options.
    """
    class Metric(models.TextChoices):
        SPH = 'SPH', _('Sphere (strongest eye)')
        CYL = 'CYL', _('Cylinder (strongest eye)')
        ADD = 'ADD', _('Addition (strongest eye)')
        PD = 'PD', _('Pupillary Distance')

    class Operator(models.TextChoices):
        GTE = 'GTE', '≥'
        LTE = 'LTE', '≤'
        GT = 'GT', '>'
        LT = 'LT', '<'
        BETWEEN = 'BETWEEN', _('between')
        EQ = 'EQ', '='

    class Action(models.TextChoices):
        RECOMMEND = 'RECOMMEND', _('Recommend (highlight)')
        RESTRICT = 'RESTRICT', _('Restrict (only allow these)')
        HIDE = 'HIDE', _('Hide (remove these)')

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    # Built-in metric (SPH/CYL/ADD/PD) OR a custom BuilderFieldConfig.field_key
    metric = models.CharField(max_length=60)
    operator = models.CharField(max_length=10, choices=Operator.choices, default=Operator.GTE)
    use_absolute = models.BooleanField(
        default=True,
        help_text=_('Compare the absolute value (SPH/CYL are often negative).')
    )
    threshold = models.DecimalField(max_digits=6, decimal_places=2)
    threshold_max = models.DecimalField(
        max_digits=6, decimal_places=2, blank=True, null=True,
        help_text=_('Upper bound — only used with the "between" operator.')
    )
    action = models.CharField(max_length=10, choices=Action.choices, default=Action.RECOMMEND)
    target_lens_types = models.ManyToManyField('LensType', blank=True, related_name='recommendation_rules')
    target_lens_options = models.ManyToManyField('LensOption', blank=True, related_name='recommendation_rules')
    message = models.TextField(blank=True, help_text=_('Optional note shown to the patient when this rule matches.'))
    priority = models.PositiveIntegerField(default=0, help_text=_('Lower numbers evaluate first.'))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['priority', 'created_at']

    def __str__(self):
        return self.name
