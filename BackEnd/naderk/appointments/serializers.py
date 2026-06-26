from rest_framework import serializers
from .models import MedicalService, Appointment, AppointmentSlotReservation
from naderk.users.models import DoctorProfile
from naderk.core.models import User

class MedicalServiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalService
        fields = ['id', 'name', 'slug', 'description', 'required_specialization',
                  'duration_minutes', 'fee', 'billing_type', 'sessions_included']

class DoctorProfileSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='user.id')
    first_name = serializers.CharField(source='user.first_name')
    last_name = serializers.CharField(source='user.last_name')
    years_experience = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = DoctorProfile
        fields = ['id', 'first_name', 'last_name', 'specialization', 'years_experience', 'bio', 'avatar']

    def get_years_experience(self, obj):
        # years_of_experience is set by the onboarding form; years_experience by the seed
        return obj.years_of_experience or obj.years_experience or 0

    def get_avatar(self, obj):
        # Prefer uploaded Cloudinary profile_picture, fall back to seeded avatar URL
        return obj.profile_picture or obj.avatar or None

class AppointmentSerializer(serializers.ModelSerializer):
    service = MedicalServiceSerializer(read_only=True)
    doctor = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    appointment_type_display = serializers.CharField(source='get_appointment_type_display', read_only=True)
    is_telehealth = serializers.SerializerMethodField()
    is_physical = serializers.SerializerMethodField()
    can_join = serializers.SerializerMethodField()
    telehealth_session_id = serializers.SerializerMethodField()
    
    class Meta:
        model = Appointment
        fields = [
            'id', 'service', 'doctor', 'appointment_date', 'appointment_time',
            'appointment_type', 'appointment_type_display', 'status', 'status_display', 
            'consultation_fee', 'payment_status', 'notes', 'created_at',
            'meeting_link', 'checked_in_at', 'started_at', 'completed_at', 'missed_at', 'cancelled_at',
            'is_telehealth', 'is_physical', 'can_join', 'telehealth_session_id'
        ]
        
    def get_doctor(self, obj):
        try:
            profile = obj.doctor.doctor_profile
            return DoctorProfileSerializer(profile).data
        except DoctorProfile.DoesNotExist:
            return {
                "first_name": obj.doctor.first_name,
                "last_name": obj.doctor.last_name
            }

    def get_telehealth_session_id(self, obj):
        try:
            return obj.telehealth_session.id
        except Exception:
            return None

    def get_is_telehealth(self, obj):
        return obj.appointment_type == Appointment.AppointmentType.TELEHEALTH

    def get_is_physical(self, obj):
        return obj.appointment_type == Appointment.AppointmentType.PHYSICAL

    def get_can_join(self, obj):
        if obj.appointment_type != Appointment.AppointmentType.TELEHEALTH:
            return False
        if obj.status not in [Appointment.Status.CONFIRMED, Appointment.Status.CHECKED_IN, Appointment.Status.IN_PROGRESS]:
            return False
        try:
            return obj.telehealth_session is not None
        except Exception:
            return False

class AssignSpecialistRequestSerializer(serializers.Serializer):
    service_id = serializers.UUIDField()
    date = serializers.DateField()

class AvailableSlotsRequestSerializer(serializers.Serializer):
    doctor_id = serializers.UUIDField()
    date = serializers.DateField()

class ReserveSlotRequestSerializer(serializers.Serializer):
    doctor_id = serializers.UUIDField()
    date = serializers.DateField()
    time = serializers.TimeField()

class CreateAppointmentRequestSerializer(serializers.Serializer):
    service_id = serializers.UUIDField()
    doctor_id = serializers.UUIDField()
    date = serializers.DateField()
    time = serializers.TimeField()
    appointment_type = serializers.ChoiceField(choices=Appointment.AppointmentType.choices)
    notes = serializers.CharField(required=False, allow_blank=True)

class RescheduleAppointmentRequestSerializer(serializers.Serializer):
    date = serializers.DateField()
    time = serializers.TimeField()
