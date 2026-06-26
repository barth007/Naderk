from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from naderk.users.models import StaffProfile, DoctorProfile, DoctorNote
from naderk.appointments.models import Appointment, MedicalService

User = get_user_model()

class RoleAwarePortalTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        
        # Create a doctor user
        self.doctor = User.objects.create_user(
            email='doctor@naderk.com',
            password='doctorpassword123',
            first_name='Sarah',
            last_name='Bwala',
            role=User.Role.DOCTOR,
            is_verified=True,
            otp_verified=True
        )
        
        # Create a patient user
        self.patient = User.objects.create_user(
            email='patient@naderk.com',
            password='patientpassword123',
            first_name='Sarah',
            last_name='Patient',
            role=User.Role.PATIENT,
            is_verified=True,
            otp_verified=True
        )
        
        # Setup medical service & appointment for stats testing
        self.service = MedicalService.objects.create(
            name="Comprehensive Exam",
            slug="comp-exam",
            description="30-min eye exam",
            required_specialization=DoctorProfile.Specialization.OPHTHALMOLOGIST,
            duration_minutes=30
        )
        
    def test_profile_auto_creation_signals(self):
        """
        Verify that DoctorProfile and StaffProfile are auto-created when user is DOCTOR.
        Verify that PatientProfile is auto-created when user is PATIENT.
        """
        self.assertIsNotNone(self.doctor.staff_profile)
        self.assertIsNotNone(self.doctor.doctor_profile)
        self.assertEqual(self.doctor.staff_profile.department, "Ophthalmology")
        
        self.assertIsNotNone(self.patient.patient_profile)
        self.assertFalse(hasattr(self.patient, 'staff_profile'))
        
    def test_auth_me_endpoint_doctor(self):
        """
        Verify that GET /api/v1/auth/me/ returns appropriate role and profile metadata.
        """
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['success'])
        
        data = response.data['data']
        self.assertEqual(data['email'], 'doctor@naderk.com')
        self.assertEqual(data['role'], 'DOCTOR')
        self.assertEqual(data['full_name'], 'Sarah Bwala')
        self.assertIn('access_patient_records', data['permissions'])
        self.assertIn('access_clinical_notes', data['permissions'])
        self.assertEqual(data['specialization'], 'Ophthalmologist')
        
    def test_doctor_dashboard_summary(self):
        """
        Verify that summary metrics returns correct real stats (not placeholders).
        """
        # Create a sample confirmed appointment
        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            service=self.service,
            appointment_date=timezone.now().date(),
            appointment_time=timezone.now().time(),
            status=Appointment.Status.CONFIRMED,
            consultation_fee=150.00
        )
        
        # Create a pending appointment
        Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            service=self.service,
            appointment_date=timezone.now().date(),
            appointment_time=timezone.now().time(),
            status=Appointment.Status.PENDING,
            consultation_fee=150.00
        )
        
        self.client.force_authenticate(user=self.doctor)
        response = self.client.get('/api/v1/dashboard/doctor/summary/')
        self.assertEqual(response.status_code, 200)
        
        data = response.data['data']
        self.assertEqual(data['total_appointments'], 2)
        self.assertEqual(data['appointments_today'], 2)
        self.assertEqual(data['new_appointments'], 1) # PENDING count
        self.assertEqual(data['cancelled_appointments'], 0)

    def test_doctor_scratchpad_retention_rules(self):
        """
        Verify note retrieval works and filters out notes older than 30 days.
        """
        self.client.force_authenticate(user=self.doctor)
        
        # 1. Post a new note
        response = self.client.post('/api/v1/dashboard/doctor/scratchpad/', {'content': 'This is a test clinical scratchpad note'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['data']['content'], 'This is a test clinical scratchpad note')
        
        # 2. Get note - should return the note we just posted
        response = self.client.get('/api/v1/dashboard/doctor/scratchpad/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['content'], 'This is a test clinical scratchpad note')
        
        # 3. Create an old note (updated 31 days ago) and ensure it's excluded
        old_note = DoctorNote.objects.create(
            doctor=self.doctor,
            content='Old clinical note',
            note_type='TEMPORARY'
        )
        # Update updated_at back in time using update()
        DoctorNote.objects.filter(id=old_note.id).update(
            updated_at=timezone.now() - timezone.timedelta(days=31),
            created_at=timezone.now() - timezone.timedelta(days=31)
        )
        
        # The API should retrieve the new note, NOT the old note
        response = self.client.get('/api/v1/dashboard/doctor/scratchpad/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['data']['content'], 'This is a test clinical scratchpad note')

    def test_doctor_onboarding_and_profile_endpoint(self):
        """
        Verify that Doctor profile details can be updated via PUT /api/v1/users/profile/
        and that completion flips to COMPLETED when required fields are populated.
        """
        self.client.force_authenticate(user=self.doctor)
        
        # Initially pending
        self.assertEqual(self.doctor.profile_completion_status, 'PENDING')
        
        # Update details via the API
        payload = {
            'first_name': 'SarahUpdated',
            'last_name': 'BwalaUpdated',
            'phone_number': '+2348000001111',
            'date_of_birth': '1985-05-15',
            'gender': 'Female',
            'specialization': 'OPHTHALMOLOGIST',
            'license_number': 'LIC-12345',
            'years_of_experience': 10,
            'office_address': 'Suite 100, Abuja Wing',
            'employment_date': '2024-06-09',
            'bio': 'Test bio content',
            'max_daily_patients': 20
        }
        
        response = self.client.put('/api/v1/users/profile/', payload, format='json')
        self.assertEqual(response.status_code, 200)
        
        # Verify user attributes are updated
        self.doctor.refresh_from_db()
        self.assertEqual(self.doctor.first_name, 'SarahUpdated')
        self.assertEqual(self.doctor.phone_number, '+2348000001111')
        self.assertEqual(self.doctor.gender, 'Female')
        
        # Verify DoctorProfile details
        doc_profile = self.doctor.doctor_profile
        self.assertEqual(doc_profile.license_number, 'LIC-12345')
        self.assertEqual(doc_profile.max_daily_patients, 20)
        
        # Verify StaffProfile details
        staff_profile = self.doctor.staff_profile
        self.assertEqual(staff_profile.office_address, 'Suite 100, Abuja Wing')
        
        # Verify user state is completed
        self.assertEqual(self.doctor.profile_completion_status, 'COMPLETED')

