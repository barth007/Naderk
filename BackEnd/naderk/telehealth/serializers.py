from rest_framework import serializers
from naderk.telehealth.models import TelehealthSession, TelehealthParticipant, TelehealthEvent
from django.contrib.auth import get_user_model

User = get_user_model()

class UserMinimalSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    role = serializers.CharField()
    hospital_id = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'display_name', 'role', 'hospital_id']

    def get_display_name(self, obj):
        return f"{obj.first_name} {obj.last_name}".strip() or obj.email

    def get_hospital_id(self, obj):
        if obj.role == User.Role.PATIENT:
            try:
                # In phase 11 user profile has patient_id or patient_profile
                profile = getattr(obj, 'patient_profile', None)
                if profile:
                    return getattr(profile, 'patient_id', None)
                # Fallback to general lookup
                from naderk.users.models import PatientProfile
                profile = PatientProfile.objects.filter(user=obj).first()
                if profile:
                    return profile.patient_id
            except Exception:
                pass
        return None

class TelehealthParticipantSerializer(serializers.ModelSerializer):
    user = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = TelehealthParticipant
        fields = ['id', 'user', 'role', 'joined_at', 'left_at', 'connection_status']

class TelehealthEventSerializer(serializers.ModelSerializer):
    actor = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = TelehealthEvent
        fields = ['id', 'event_type', 'actor', 'metadata', 'created_at']

class TelehealthSessionSerializer(serializers.ModelSerializer):
    patient = UserMinimalSerializer(source='appointment.patient', read_only=True)
    doctor = UserMinimalSerializer(source='appointment.doctor', read_only=True)
    service_name = serializers.CharField(source='appointment.service.name', read_only=True)
    appointment_id = serializers.UUIDField(source='appointment.id', read_only=True)
    participants = TelehealthParticipantSerializer(many=True, read_only=True)
    events = TelehealthEventSerializer(many=True, read_only=True)

    class Meta:
        model = TelehealthSession
        fields = [
            'id', 'appointment_id', 'patient', 'doctor', 'service_name', 
            'room_name', 'room_id', 'status', 'scheduled_start', 'scheduled_end',
            'started_at', 'ended_at', 'duration_minutes', 'conversation_id',
            'session_notes', 'participants', 'events', 'created_at', 'updated_at'
        ]
