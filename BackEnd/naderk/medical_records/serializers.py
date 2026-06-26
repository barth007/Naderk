from rest_framework import serializers
from naderk.users.models import DoctorProfile
from naderk.core.models import User
from naderk.ecommerce.models import Prescription
from naderk.ecommerce.serializers import PrescriptionSerializer
from .models import ConsultationEncounter, DiagnosticResult, DiagnosticAttachment, MedicalScan, Medication

class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone_number']

class DoctorMinimalSerializer(serializers.ModelSerializer):
    specialization = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'specialization', 'avatar']

    def get_specialization(self, obj):
        try:
            return obj.doctor_profile.specialization
        except Exception:
            return "General Practitioner"

    def get_avatar(self, obj):
        try:
            return obj.doctor_profile.avatar or obj.doctor_profile.profile_picture
        except Exception:
            return None

class MedicationSerializer(serializers.ModelSerializer):
    prescribed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Medication
        fields = [
            'id', 'patient', 'encounter', 'prescribed_by', 'prescribed_by_name',
            'name', 'dosage', 'frequency', 'status', 'start_date', 'end_date', 'created_at'
        ]

    def get_prescribed_by_name(self, obj):
        return f"Dr. {obj.prescribed_by.first_name} {obj.prescribed_by.last_name}".strip()


class MedicationCreateSerializer(serializers.ModelSerializer):
    patient_id = serializers.UUIDField(write_only=True)
    encounter_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Medication
        fields = ['patient_id', 'encounter_id', 'name', 'dosage', 'frequency', 'start_date', 'end_date']

    def create(self, validated_data):
        from naderk.core.models import User
        patient_id = validated_data.pop('patient_id')
        encounter_id = validated_data.pop('encounter_id', None)
        patient = User.objects.get(id=patient_id)
        encounter = None
        if encounter_id:
            encounter = ConsultationEncounter.objects.filter(id=encounter_id).first()
        return Medication.objects.create(
            patient=patient,
            encounter=encounter,
            prescribed_by=self.context['request'].user,
            **validated_data
        )

class DiagnosticAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = DiagnosticAttachment
        fields = ['id', 'diagnostic_result', 'file', 'file_type', 'name', 'created_at']

class DiagnosticResultSerializer(serializers.ModelSerializer):
    attachments = DiagnosticAttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = DiagnosticResult
        fields = [
            'id', 'patient', 'encounter', 'test_name', 'category', 'status',
            'result_summary', 'attachments', 'created_at'
        ]

class MedicalScanSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MedicalScan
        fields = [
            'id', 'patient', 'encounter', 'scan_type', 'image', 'captured_at',
            'uploaded_by', 'uploaded_by_name', 'created_at'
        ]

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"Dr. {obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip()
        return "System"

class ConsultationEncounterSerializer(serializers.ModelSerializer):
    doctor_detail = DoctorMinimalSerializer(source='doctor', read_only=True)
    patient_detail = UserMinimalSerializer(source='patient', read_only=True)

    class Meta:
        model = ConsultationEncounter
        fields = [
            'id', 'patient', 'patient_detail', 'doctor', 'doctor_detail',
            'appointment', 'telehealth_session', 'notes', 'diagnosis',
            'clinical_findings', 'reference_number', 'recommendations',
            'follow_up_date', 'created_at', 'updated_at'
        ]

class ConsultationEncounterDetailSerializer(serializers.ModelSerializer):
    doctor_detail = DoctorMinimalSerializer(source='doctor', read_only=True)
    patient_detail = UserMinimalSerializer(source='patient', read_only=True)
    medications = MedicationSerializer(many=True, read_only=True)
    diagnostics = DiagnosticResultSerializer(many=True, read_only=True)
    scans = MedicalScanSerializer(many=True, read_only=True)
    eyewear_prescriptions = PrescriptionSerializer(many=True, read_only=True)
    complaints = serializers.SerializerMethodField()

    class Meta:
        model = ConsultationEncounter
        fields = [
            'id', 'patient', 'patient_detail', 'doctor', 'doctor_detail',
            'appointment', 'telehealth_session', 'notes', 'diagnosis',
            'clinical_findings', 'reference_number', 'recommendations',
            'follow_up_date', 'complaints', 'medications', 'diagnostics',
            'scans', 'eyewear_prescriptions', 'created_at', 'updated_at'
        ]

    def get_complaints(self, obj):
        if obj.appointment and obj.appointment.notes:
            return obj.appointment.notes
        return None
