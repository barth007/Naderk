from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from naderk.appointments.models import Appointment, MedicalService
from naderk.users.models import PatientProfile
from naderk.ecommerce.models import Prescription
from .models import ConsultationEncounter, DiagnosticResult, DiagnosticAttachment, MedicalScan, Medication

User = get_user_model()

class PatientRecordsApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Doctors
        self.doctor = User.objects.create_user(
            email='doctor@naderk.com',
            password='doctorpassword123',
            first_name='Sarah',
            last_name='Bwala',
            role=User.Role.DOCTOR,
            is_verified=True,
            otp_verified=True
        )
        
        self.unassigned_doctor = User.objects.create_user(
            email='unassigned_doctor@naderk.com',
            password='doctorpassword123',
            first_name='Frank',
            last_name='Miller',
            role=User.Role.DOCTOR,
            is_verified=True,
            otp_verified=True
        )
        
        # Medical Agent
        self.medical_agent = User.objects.create_user(
            email='agent@naderk.com',
            password='agentpassword123',
            first_name='Agent',
            last_name='Smith',
            role=User.Role.MEDICAL_AGENT,
            is_verified=True,
            otp_verified=True
        )
        
        # Patients
        self.patient = User.objects.create_user(
            email='patient@naderk.com',
            password='patientpassword123',
            first_name='John',
            last_name='Doe',
            role=User.Role.PATIENT,
            is_verified=True,
            otp_verified=True
        )
        
        # Modify the auto-created Patient Profile
        self.patient_profile = self.patient.patient_profile
        self.patient_profile.patient_id = 'NDK01001'
        self.patient_profile.dob = '1999-02-28'
        self.patient_profile.gender = 'Male'
        self.patient_profile.phone_number = '08108620823'
        self.patient_profile.address = '1234 Street CRD Lugbe'
        self.patient_profile.reason_for_visit = 'Blurry vision, severe headache'
        self.patient_profile.save()
        
        # Unauthorized Patient
        self.unauthorized_patient = User.objects.create_user(
            email='random@naderk.com',
            password='randompassword123',
            first_name='Random',
            last_name='User',
            role=User.Role.PATIENT,
            is_verified=True,
            otp_verified=True
        )
        
        # Medical Service
        self.service = MedicalService.objects.create(
            name='General Eye Exam',
            slug='general-eye-exam',
            required_specialization='OPHTHALMOLOGIST',
            duration_minutes=30
        )
        
        # Active/Confirmed Appointment with Doctor
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            service=self.service,
            appointment_date=timezone.now().date(),
            appointment_time=timezone.now().time(),
            appointment_type=Appointment.AppointmentType.PHYSICAL,
            status=Appointment.Status.CONFIRMED,
            consultation_fee=100.0
        )

        # Let's create an Encounter linked to the patient
        self.encounter = ConsultationEncounter.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            appointment=self.appointment,
            notes="Initial encounter notes.",
            diagnosis="Myopia",
            clinical_findings="Reduced distance visual acuity.",
            recommendations="Wear eyeglasses regularly."
        )

        # Create Eyewear Prescription
        self.prescription = Prescription.objects.create(
            patient=self.patient,
            encounter=self.encounter,
            right_sph=1.50,
            right_cyl=-0.50,
            right_axis=90,
            right_add=0.00,
            left_sph=1.75,
            left_cyl=-0.75,
            left_axis=95,
            left_add=0.00,
            pupillary_distance=63.0,
            status=Prescription.Status.APPROVED
        )

        # Create Medication
        self.medication = Medication.objects.create(
            patient=self.patient,
            encounter=self.encounter,
            prescribed_by=self.doctor,
            name="Latanoprost",
            dosage="0.005%",
            frequency="Once daily at bedtime",
            status=Medication.Status.ACTIVE,
            start_date=timezone.now().date()
        )

        # Create Diagnostic Result
        self.diagnostic = DiagnosticResult.objects.create(
            patient=self.patient,
            encounter=self.encounter,
            test_name="OCT Scan",
            category="Imaging",
            status=DiagnosticResult.Status.READY,
            result_summary="Macula is clear."
        )
        
        self.attachment = DiagnosticAttachment.objects.create(
            diagnostic_result=self.diagnostic,
            file="https://example.com/scan.pdf",
            file_type=DiagnosticAttachment.FileType.PDF,
            name="OCT PDF report"
        )

        # Create Medical Scan
        self.scan = MedicalScan.objects.create(
            patient=self.patient,
            encounter=self.encounter,
            scan_type="Fundus Photography",
            image="https://example.com/fundus.jpg",
            captured_at=timezone.now().date(),
            uploaded_by=self.doctor
        )

    def test_list_patient_records_success(self):
        """
        Verify doctor can retrieve list of patients with their records successfully.
        """
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/v1/medical-records/patients/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        
        data = response.data['data']
        self.assertEqual(len(data), 1)
        record = data[0]
        self.assertEqual(record['patient_id'], 'NDK01001')
        self.assertEqual(record['name'], 'John Doe')
        self.assertEqual(record['phone_number'], '08108620823')
        self.assertEqual(record['gender'], 'Male')
        self.assertEqual(record['address'], '1234 Street CRD Lugbe')

    def test_search_patient_records_found(self):
        """
        Verify search filters records correctly when a match is found.
        """
        self.client.force_authenticate(user=self.doctor)
        # Search by first name
        response = self.client.get('/api/v1/medical-records/patients/?q=John')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['data']), 1)

    def test_patient_records_unauthorized(self):
        """
        Verify patients cannot view the clinical patient records database.
        """
        self.client.force_authenticate(user=self.unauthorized_patient)
        response = self.client.get('/api/v1/medical-records/patients/')
        self.assertEqual(response.status_code, 403)

    def test_patient_can_view_own_records(self):
        """
        Verify that a patient can view their own medical records overview.
        """
        self.client.force_authenticate(user=self.patient)
        response = self.client.get('/api/v1/medical-records/overview/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        
        data = response.data['data']
        self.assertEqual(data['patient_info']['email'], self.patient.email)
        self.assertEqual(len(data['recent_encounters']), 1)
        self.assertEqual(len(data['active_medications']), 1)

    def test_doctor_can_view_assigned_patient_records(self):
        """
        Verify that an assigned doctor can view patient's medical records overview.
        """
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get(f'/api/v1/medical-records/overview/?patient_id={self.patient.id}')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])

    def test_doctor_cannot_view_unassigned_patient_records(self):
        """
        Verify that an unassigned doctor cannot view patient's medical records.
        """
        # Cancel the appointment first to make the doctor unassigned
        self.appointment.status = Appointment.Status.CANCELLED
        self.appointment.save()

        self.client.force_authenticate(user=self.unassigned_doctor)
        response = self.client.get(f'/api/v1/medical-records/overview/?patient_id={self.patient.id}')
        self.assertEqual(response.status_code, 403)

    def test_medical_agent_access_is_forbidden(self):
        """
        Verify that an unassigned medical agent is blocked with 403 Forbidden.
        """
        self.client.force_authenticate(user=self.medical_agent)
        response = self.client.get(f'/api/v1/medical-records/overview/?patient_id={self.patient.id}')
        self.assertEqual(response.status_code, 403)

    def test_prescription_pdf_generation(self):
        """
        Verify dynamic prescription PDF compilation works and returns PDF content.
        """
        self.client.force_authenticate(user=self.patient)
        response = self.client.get(f'/api/v1/medical-records/prescriptions/{self.prescription.id}/pdf/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        content = b"".join(response.streaming_content)
        self.assertTrue(len(content) > 0)

    def test_encounter_search_filtering(self):
        """
        Verify encounter search matches diagnosis, notes, or reference number.
        """
        self.client.force_authenticate(user=self.doctor)
        # Match diagnosis
        response = self.client.get(f'/api/v1/medical-records/encounters/?patient_id={self.patient.id}&search=Myopia')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['count'], 1)

        # No match
        response = self.client.get(f'/api/v1/medical-records/encounters/?patient_id={self.patient.id}&search=Glaucoma')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['count'], 0)
