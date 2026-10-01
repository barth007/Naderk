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

class DiagnosticResultCreateSerializer(serializers.ModelSerializer):
    """
    Doctor-authored diagnostic result, recorded against a consultation.

    Mirrors MedicationCreateSerializer, but additionally verifies the doctor
    actually has access to the patient. Writing a result for an arbitrary
    patient id would otherwise be possible for any authenticated doctor.
    """
    patient_id = serializers.UUIDField(write_only=True)
    encounter_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = DiagnosticResult
        fields = [
            'patient_id', 'encounter_id', 'test_name', 'category',
            'status', 'result_summary',
        ]

    def validate(self, attrs):
        from naderk.core.models import User
        from .permissions import IsRecordOwnerOrDoctorWithActiveAppointment

        doctor = self.context['request'].user

        try:
            patient = User.objects.get(id=attrs['patient_id'])
        except User.DoesNotExist:
            raise serializers.ValidationError({'patient_id': 'No such patient.'})

        if patient.role != 'PATIENT':
            raise serializers.ValidationError({'patient_id': 'User is not a patient.'})

        if doctor.role not in ('ADMIN', 'SUPER_ADMIN'):
            checker = IsRecordOwnerOrDoctorWithActiveAppointment()
            if not checker.has_patient_access(doctor, patient):
                raise serializers.ValidationError(
                    'You do not have access to this patient\'s records.'
                )

        encounter_id = attrs.get('encounter_id')
        if encounter_id:
            encounter = ConsultationEncounter.objects.filter(id=encounter_id).first()
            if not encounter:
                raise serializers.ValidationError({'encounter_id': 'No such consultation.'})
            if encounter.patient_id != patient.id:
                raise serializers.ValidationError(
                    {'encounter_id': 'Consultation does not belong to this patient.'}
                )
            attrs['_encounter'] = encounter

        attrs['_patient'] = patient
        return attrs

    def create(self, validated_data):
        validated_data.pop('patient_id')
        validated_data.pop('encounter_id', None)
        patient = validated_data.pop('_patient')
        encounter = validated_data.pop('_encounter', None)
        return DiagnosticResult.objects.create(
            patient=patient,
            encounter=encounter,
            **validated_data
        )


class DiagnosticResultUpdateSerializer(serializers.ModelSerializer):
    """Lets the recording doctor correct a result or move PENDING -> READY."""

    class Meta:
        model = DiagnosticResult
        fields = ['test_name', 'category', 'status', 'result_summary']
        extra_kwargs = {f: {'required': False} for f in fields}


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
