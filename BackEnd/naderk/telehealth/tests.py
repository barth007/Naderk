import datetime
from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from naderk.appointments.models import Appointment, MedicalService
from naderk.telehealth.models import TelehealthSession, TelehealthParticipant, TelehealthEvent
from naderk.telehealth.services.generate_token import generate_livekit_token
from naderk.telehealth.services.session_lifecycle import join_session, leave_session, end_session
from naderk.telehealth.tasks import check_missed_sessions, send_session_reminders

User = get_user_model()

class TelehealthTestCase(TestCase):
    def setUp(self):
        # Create users
        self.patient = User.objects.create_user(
            email='patient@example.com',
            password='testpassword',
            first_name='Patient',
            last_name='User',
            role=User.Role.PATIENT
        )
        
        self.doctor = User.objects.create_user(
            email='doctor@example.com',
            password='testpassword',
            first_name='Doctor',
            last_name='Eye',
            role=User.Role.DOCTOR
        )
        
        self.unauthorized_user = User.objects.create_user(
            email='random@example.com',
            password='testpassword',
            first_name='Random',
            last_name='User',
            role=User.Role.PATIENT
        )

        # Create service
        self.service = MedicalService.objects.create(
            name='Telehealth Exam',
            slug='telehealth-exam',
            required_specialization='OPHTHALMOLOGIST',
            duration_minutes=30
        )

    def test_appointment_confirmed_creates_session(self):
        """
        Verify that confirming a TELEHEALTH appointment automatically creates a session.
        """
        appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            service=self.service,
            appointment_date=timezone.now().date(),
            appointment_time=timezone.now().time(),
            appointment_type=Appointment.AppointmentType.TELEHEALTH,
            status=Appointment.Status.PENDING,
            consultation_fee=1000.0
        )
        
        # Session shouldn't exist yet
        self.assertFalse(TelehealthSession.objects.filter(appointment=appointment).exists())
        
        # Confirm appointment
        appointment.status = Appointment.Status.CONFIRMED
        appointment.save()
        
        # Session should now exist
        self.assertTrue(TelehealthSession.objects.filter(appointment=appointment).exists())
        session = appointment.telehealth_session
        self.assertEqual(session.status, TelehealthSession.Status.SCHEDULED)
        self.assertEqual(session.room_name, f"telehealth-appointment-{appointment.id}")

    def test_token_access_control(self):
        """
        Verify only session participants or staff can generate LiveKit tokens.
        """
        appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            service=self.service,
            appointment_date=timezone.now().date(),
            appointment_time=timezone.now().time(),
            appointment_type=Appointment.AppointmentType.TELEHEALTH,
            status=Appointment.Status.CONFIRMED,
            consultation_fee=1000.0
        )
        session = appointment.telehealth_session
        
        # Patient & Doctor should succeed
        token_pat = generate_livekit_token(session=session, user=self.patient)
        token_doc = generate_livekit_token(session=session, user=self.doctor)
        self.assertIsNotNone(token_pat)
        self.assertIsNotNone(token_doc)
        
        # Unauthorized should fail
        with self.assertRaises(PermissionError):
            generate_livekit_token(session=session, user=self.unauthorized_user)

    def test_session_lifecycle(self):
        """
        Verify state transitions when patient and doctor join/leave/end the session.
        """
        appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            service=self.service,
            appointment_date=timezone.now().date(),
            appointment_time=timezone.now().time(),
            appointment_type=Appointment.AppointmentType.TELEHEALTH,
            status=Appointment.Status.CONFIRMED,
            consultation_fee=1000.0
        )
        session = appointment.telehealth_session
        
        # 1. Patient joins waiting room -> status becomes WAITING_ROOM
        join_session(session=session, user=self.patient)
        session.refresh_from_db()
        self.assertEqual(session.status, TelehealthSession.Status.WAITING_ROOM)
        
        # Verify participant status
        participant = session.participants.get(user=self.patient)
        self.assertEqual(participant.role, TelehealthParticipant.Role.PATIENT)
        self.assertEqual(participant.connection_status, TelehealthParticipant.ConnectionStatus.CONNECTED)
        
        # 2. Doctor joins -> status becomes ACTIVE, appointment becomes IN_PROGRESS
        join_session(session=session, user=self.doctor)
        session.refresh_from_db()
        appointment.refresh_from_db()
        self.assertEqual(session.status, TelehealthSession.Status.ACTIVE)
        self.assertEqual(appointment.status, Appointment.Status.IN_PROGRESS)
        
        # 3. Leave session
        leave_session(session=session, user=self.patient)
        participant.refresh_from_db()
        self.assertEqual(participant.connection_status, TelehealthParticipant.ConnectionStatus.DISCONNECTED)
        
        # 4. Doctor ends session -> status becomes COMPLETED, appointment becomes COMPLETED
        end_session(session=session, user=self.doctor)
        session.refresh_from_db()
        appointment.refresh_from_db()
        self.assertEqual(session.status, TelehealthSession.Status.COMPLETED)
        self.assertEqual(appointment.status, Appointment.Status.COMPLETED)

    def test_missed_sessions_tasks(self):
        """
        Test the check_missed_sessions background task.
        """
        # Create an expired confirmed appointment (scheduled start 30 mins in past)
        past_date = timezone.now().date()
        past_time = (timezone.now() - datetime.timedelta(minutes=30)).time()
        
        appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            service=self.service,
            appointment_date=past_date,
            appointment_time=past_time,
            appointment_type=Appointment.AppointmentType.TELEHEALTH,
            status=Appointment.Status.CONFIRMED,
            consultation_fee=1000.0
        )
        session = appointment.telehealth_session
        
        # Mock scheduled start to be in the past to trigger timeout
        session.scheduled_start = timezone.now() - datetime.timedelta(minutes=20)
        session.save()
        
        # Run check task (neither joined)
        result = check_missed_sessions()
        session.refresh_from_db()
        appointment.refresh_from_db()
        self.assertEqual(session.status, TelehealthSession.Status.MISSED)
        self.assertEqual(appointment.status, Appointment.Status.NO_SHOW)
