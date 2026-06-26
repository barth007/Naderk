from rest_framework.permissions import BasePermission
from django.shortcuts import get_object_or_404
from naderk.appointments.models import Appointment
from naderk.core.models import User
from .models import ConsultationEncounter, DiagnosticResult, MedicalScan, Medication
from naderk.ecommerce.models import Prescription

class IsRecordOwnerOrDoctorWithActiveAppointment(BasePermission):
    """
    Custom permission to enforce:
    1. Patients can only access their own records.
    2. Admins/Super admins have full access.
    3. Doctors can access if:
       - They have an active/upcoming appointment with the patient (status in ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']).
       - OR they created/authored the record (encounter.doctor == user, medication.prescribed_by == user, scan.uploaded_by == user, prescription.encounter.doctor == user).
    4. Other staff roles (agents, opticians) are blocked unless they created the record.
    """
    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Admins have full access
        if request.user.role in ['ADMIN', 'SUPER_ADMIN']:
            return True
            
        # Patients can always access their own
        if request.user.role == 'PATIENT':
            return True

        # For list views and overview where a patient_id is passed in query params
        patient_id = request.query_params.get('patient_id') or request.data.get('patient_id')
        if patient_id:
            try:
                patient = User.objects.get(id=patient_id)
            except (User.DoesNotExist, ValueError):
                return False
                
            return self.has_patient_access(request.user, patient)
            
        return True

    def has_object_permission(self, request, view, obj):
        user = request.user
        
        # Admins have full access
        if user.role in ['ADMIN', 'SUPER_ADMIN']:
            return True

        # Check who the patient of the object is
        patient = getattr(obj, 'patient', None)
        if not patient and hasattr(obj, 'encounter') and obj.encounter:
            patient = obj.encounter.patient
            
        if not patient:
            return False

        # Patients can only view their own
        if user.role == 'PATIENT':
            return patient == user

        # Verify if doctor/agent has access to this patient
        return self.has_patient_access(user, patient, obj)

    def has_patient_access(self, user, patient, obj=None):
        # Check if they are the patient themselves
        if user == patient:
            return True

        # Check if there is an active/upcoming appointment between doctor and patient
        active_statuses = ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS']
        has_active_appt = Appointment.objects.filter(
            doctor=user,
            patient=patient,
            status__in=active_statuses
        ).exists()
        
        if has_active_appt:
            return True

        # Check if they created the record (if obj is provided)
        if obj:
            if isinstance(obj, ConsultationEncounter):
                return obj.doctor == user
            elif isinstance(obj, Medication):
                return obj.prescribed_by == user
            elif isinstance(obj, MedicalScan):
                return obj.uploaded_by == user
            elif isinstance(obj, DiagnosticResult):
                if obj.encounter and obj.encounter.doctor == user:
                    return True
            elif isinstance(obj, Prescription):
                if obj.encounter and obj.encounter.doctor == user:
                    return True

        # Check if they authored *any* record for this patient
        has_encounter = ConsultationEncounter.objects.filter(doctor=user, patient=patient).exists()
        if has_encounter:
            return True
            
        has_med = Medication.objects.filter(prescribed_by=user, patient=patient).exists()
        if has_med:
            return True
            
        has_scan = MedicalScan.objects.filter(uploaded_by=user, patient=patient).exists()
        if has_scan:
            return True

        return False
