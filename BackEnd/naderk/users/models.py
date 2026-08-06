from django.db import models
from django.conf import settings
import uuid


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class Specialization(models.Model):
    """
    Clinical specializations a doctor can hold, editable from the admin panel.

    `code` is the value actually stored on DoctorProfile.specialization and
    MedicalService.required_specialization, and it is what the booking engine
    matches on — so it is immutable once created. `name` is display-only and
    can be renamed freely.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(
        max_length=50, unique=True,
        help_text="Stored value, e.g. OPTOMETRIST. Immutable once created.",
    )
    name = models.CharField(max_length=100, help_text="Display label, e.g. Optometrist")
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


def specialization_label(code):
    """
    Display name for a specialization code. Falls back to a prettified code so
    doctors carrying a code that was later deactivated (or predates the table)
    still render sensibly instead of showing a raw enum value.
    """
    if not code:
        return ''
    spec = Specialization.objects.filter(code=code).only('name').first()
    if spec:
        return spec.name
    return code.replace('_', ' ').title()


class RolePermissionConfig(models.Model):
    """Stores which system permissions each staff role has."""
    role = models.CharField(max_length=50, unique=True)
    permissions = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Permissions for {self.role}"

class PatientProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='patient_profile')
    patient_id = models.CharField(max_length=20, unique=True, null=True, blank=True)
    
    # Demographic Info
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=20, null=True, blank=True)
    phone_number = models.CharField(max_length=20, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    address = models.CharField(max_length=255, null=True, blank=True)
    
    # Delivery address — structured fields (used for order shipping)
    delivery_street  = models.CharField(max_length=255, null=True, blank=True)
    delivery_city    = models.CharField(max_length=100, null=True, blank=True)
    delivery_state   = models.CharField(max_length=100, null=True, blank=True)
    delivery_country = models.CharField(max_length=100, null=True, blank=True)
    # Legacy single-line field kept for backward compat — new code uses the structured fields above
    delivery_address = models.TextField(null=True, blank=True)

    # Medical & Insurance Info
    insurance_provider = models.CharField(max_length=100, null=True, blank=True)
    policy_number = models.CharField(max_length=100, null=True, blank=True)
    primary_physician = models.CharField(max_length=100, null=True, blank=True)
    reason_for_visit = models.TextField(null=True, blank=True)
    
    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=100, null=True, blank=True)
    emergency_contact_relationship = models.CharField(max_length=50, null=True, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, null=True, blank=True)
    emergency_contact_email = models.EmailField(null=True, blank=True)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profile for {self.user.email}"

class StaffProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='staff_profile')
    employee_id = models.CharField(max_length=50, unique=True, blank=True, null=True)
    department = models.CharField(max_length=100, blank=True, null=True)
    profile_picture = models.URLField(max_length=1000, blank=True, null=True)
    cover_photo = models.URLField(max_length=1000, blank=True, null=True)
    office_address = models.TextField(blank=True, null=True)
    employment_date = models.DateField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Staff Profile for {self.user.email}"


class DoctorProfile(models.Model):
    class Specialization(models.TextChoices):
        """Built-in specializations. These seed the Specialization table and
        supply defaults; the table is the authority for what admins may pick,
        so this enum is deliberately NOT used as field `choices`."""
        OPTOMETRIST = 'OPTOMETRIST', 'Optometrist'
        OPHTHALMOLOGIST = 'OPHTHALMOLOGIST', 'Ophthalmologist'
        ENT = 'ENT', 'ENT Specialist'
        GENERAL_PRACTITIONER = 'GENERAL_PRACTITIONER', 'General Practitioner'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doctor_profile')

    # No `choices`: valid values come from the Specialization table at runtime.
    specialization = models.CharField(max_length=50)
    years_experience = models.PositiveIntegerField(default=0)
    bio = models.TextField(blank=True, null=True)
    is_accepting_patients = models.BooleanField(default=True)
    max_daily_appointments = models.PositiveIntegerField(default=15)
    avatar = models.URLField(max_length=1000, blank=True, null=True)
    
    # Extensions
    license_number = models.CharField(max_length=100, blank=True, null=True)
    years_of_experience = models.PositiveIntegerField(default=0)
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    telehealth_enabled = models.BooleanField(default=True)
    availability_status = models.CharField(max_length=50, default='AVAILABLE')
    profile_picture = models.URLField(max_length=1000, blank=True, null=True)
    cover_photo = models.URLField(max_length=1000, blank=True, null=True)
    
    # Future scheduling engine support
    max_daily_patients = models.PositiveIntegerField(default=15)
    appointment_buffer_minutes = models.PositiveIntegerField(default=10)
    accepts_telehealth = models.BooleanField(default=True)
    working_hours = models.TextField(blank=True, null=True)
    consultation_duration = models.PositiveIntegerField(default=30)
    max_active_conversations = models.PositiveIntegerField(default=10)
    max_active_telehealth_sessions = models.PositiveIntegerField(default=2)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def specialization_display(self):
        return specialization_label(self.specialization)

    def __str__(self):
        return f"Dr. {self.user.last_name} ({self.specialization_display})"


class DoctorNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='doctor_notes')
    content = models.TextField()
    note_type = models.CharField(max_length=50, default='TEMPORARY')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Note {self.id} by Dr. {self.doctor.last_name} ({self.note_type})"


