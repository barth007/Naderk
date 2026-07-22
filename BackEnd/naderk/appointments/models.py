from decimal import Decimal
from django.db import models
from django.conf import settings
from naderk.users.models import DoctorProfile
import uuid

class MedicalService(models.Model):
    class BillingType(models.TextChoices):
        PER_VISIT    = 'PER_VISIT',    'Per Visit'
        MONTHLY      = 'MONTHLY',      'Monthly (unlimited sessions)'
        SESSION_PACK = 'SESSION_PACK', 'Session Pack (N sessions per payment)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=150, unique=True)
    description = models.TextField(blank=True, null=True)
    requires_doctor = models.BooleanField(
        default=True,
        help_text="If False, service is facility-based (e.g. lab test) and does not require a doctor"
    )
    required_specialization = models.CharField(
        max_length=50, choices=DoctorProfile.Specialization.choices,
        blank=True, null=True,
        help_text="Only relevant when requires_doctor is True"
    )
    duration_minutes = models.PositiveIntegerField(default=30)
    buffer_time_before = models.PositiveIntegerField(default=0, help_text="Minutes before appointment")
    buffer_time_after = models.PositiveIntegerField(default=5, help_text="Minutes after appointment")
    is_active = models.BooleanField(default=True)

    fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    billing_type = models.CharField(max_length=20, choices=BillingType.choices, default=BillingType.PER_VISIT)
    sessions_included = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='SESSION_PACK only — number of sessions per payment'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Appointment(models.Model):
    class AppointmentType(models.TextChoices):
        PHYSICAL = 'PHYSICAL', 'Physical'
        TELEHEALTH = 'TELEHEALTH', 'Telehealth'
        HOME_VISIT = 'HOME_VISIT', 'Home Visit'
        FOLLOW_UP = 'FOLLOW_UP', 'Follow-up'
        EMERGENCY = 'EMERGENCY', 'Emergency'
        
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        CHECKED_IN = 'CHECKED_IN', 'Checked In'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        RESCHEDULED = 'RESCHEDULED', 'Rescheduled'
        NO_SHOW = 'NO_SHOW', 'Missed'
        
    class PaymentStatus(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PAID = 'PAID', 'Paid'
        FAILED = 'FAILED', 'Failed'
        REFUNDED = 'REFUNDED', 'Refunded'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appointments_as_patient')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='appointments_as_doctor')
    service = models.ForeignKey(MedicalService, on_delete=models.PROTECT)
    
    appointment_date = models.DateField()
    appointment_time = models.TimeField()
    appointment_type = models.CharField(max_length=50, choices=AppointmentType.choices, default=AppointmentType.PHYSICAL)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.PENDING)
    
    consultation_fee = models.DecimalField(max_digits=10, decimal_places=2)
    consultation_valid_until = models.DateField(null=True, blank=True)
    auto_assigned = models.BooleanField(default=False)
    
    payment_status = models.CharField(max_length=50, choices=PaymentStatus.choices, default=PaymentStatus.PENDING)
    payment_reference = models.CharField(max_length=255, blank=True, null=True)
    
    notes = models.TextField(blank=True, null=True)
    cancellation_reason = models.TextField(blank=True, null=True)
    
    meeting_link = models.URLField(blank=True, null=True)
    checked_in_at = models.DateTimeField(blank=True, null=True)
    started_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    cancelled_at = models.DateTimeField(blank=True, null=True)
    missed_at = models.DateTimeField(blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['doctor']),
            models.Index(fields=['appointment_date']),
            models.Index(fields=['status']),
            models.Index(fields=['doctor', 'appointment_date', 'status']),
        ]

    def __str__(self):
        return f"{self.patient.email} - {self.service.name} on {self.appointment_date}"

class PatientServicePlan(models.Model):
    """Tracks what a patient has paid for and how many sessions remain."""
    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient            = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='service_plans')
    service            = models.ForeignKey(MedicalService, on_delete=models.CASCADE, related_name='patient_plans')
    payment_reference  = models.CharField(max_length=255)
    sessions_purchased = models.PositiveIntegerField(default=1)
    sessions_used      = models.PositiveIntegerField(default=0)
    valid_from         = models.DateField()
    valid_until        = models.DateField(null=True, blank=True)
    is_active          = models.BooleanField(default=True)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['patient', 'service', 'is_active'])]

    def __str__(self):
        return f"{self.patient.email} — {self.service.name} (used {self.sessions_used}/{self.sessions_purchased})"


class DoctorAvailability(models.Model):
    class Weekday(models.IntegerChoices):
        MONDAY = 0, 'Monday'
        TUESDAY = 1, 'Tuesday'
        WEDNESDAY = 2, 'Wednesday'
        THURSDAY = 3, 'Thursday'
        FRIDAY = 4, 'Friday'
        SATURDAY = 5, 'Saturday'
        SUNDAY = 6, 'Sunday'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='availabilities')
    weekday = models.IntegerField(choices=Weekday.choices)
    start_time = models.TimeField()
    end_time = models.TimeField()
    slot_duration = models.PositiveIntegerField(default=30, help_text="Duration in minutes")
    is_active = models.BooleanField(default=True)
    
    class Meta:
        unique_together = ('doctor', 'weekday', 'start_time')
        
    def __str__(self):
        return f"Dr. {self.doctor.last_name} - {self.get_weekday_display()} ({self.start_time} - {self.end_time})"

class AppointmentSlotReservation(models.Model):
    class Status(models.TextChoices):
        RESERVED = 'RESERVED', 'Reserved'
        BOOKED = 'BOOKED', 'Booked'
        EXPIRED = 'EXPIRED', 'Expired'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reservations_as_patient')
    doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reservations_as_doctor')
    slot_datetime = models.DateTimeField()
    expires_at = models.DateTimeField()
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.RESERVED)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['doctor', 'slot_datetime', 'status']),
            models.Index(fields=['expires_at']),
        ]

class AppointmentAuditLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment = models.ForeignKey(Appointment, on_delete=models.CASCADE, related_name='audit_logs')
    old_status = models.CharField(max_length=50, blank=True, null=True)
    new_status = models.CharField(max_length=50)
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='audit_logs_created')
    reason = models.TextField(blank=True, null=True)
    timestamp = models.DateTimeField(auto_now_add=True)

class BookingSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='booking_sessions_as_patient')
    current_step = models.IntegerField(default=1)
    selected_service = models.ForeignKey(MedicalService, on_delete=models.SET_NULL, null=True, blank=True)
    selected_doctor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='booking_sessions_as_doctor')
    reserved_slot = models.ForeignKey(AppointmentSlotReservation, on_delete=models.SET_NULL, null=True, blank=True)
    expires_at = models.DateTimeField()
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
