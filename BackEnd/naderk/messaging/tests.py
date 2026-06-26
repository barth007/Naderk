from django.test import TestCase
from django.utils import timezone
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from naderk.messaging.models import (
    Conversation, 
    ConversationStatus, 
    ConversationPriority, 
    Message, 
    ConversationAssignmentHistory
)
from naderk.messaging.services import (
    create_conversation, 
    send_message, 
    assign_conversation
)
from naderk.users.models import DoctorProfile
from naderk.appointments.models import Appointment, MedicalService
from naderk.telehealth.models import TelehealthSession

User = get_user_model()

class MessagingTestCase(TestCase):
    def setUp(self):
        self.patient = User.objects.create_user(
            email='patient@example.com',
            password='testpassword',
            first_name='Patient',
            last_name='User',
            role=User.Role.PATIENT
        )
        self.agent = User.objects.create_user(
            email='agent@example.com',
            password='testpassword',
            first_name='Agent',
            last_name='Triage',
            role=User.Role.MEDICAL_AGENT
        )
        self.doctor = User.objects.create_user(
            email='doctor@example.com',
            password='testpassword',
            first_name='Doctor',
            last_name='Eye',
            role=User.Role.DOCTOR
        )
        # DoctorProfile is automatically created via signals, so let's update it.
        self.doctor_profile = DoctorProfile.objects.get(user=self.doctor)
        self.doctor_profile.specialization = 'OPTOMETRIST'
        self.doctor_profile.max_active_conversations = 2
        self.doctor_profile.max_active_telehealth_sessions = 1
        self.doctor_profile.max_daily_patients = 2
        self.doctor_profile.availability_status = 'AVAILABLE'
        self.doctor_profile.is_accepting_patients = True
        self.doctor_profile.save()
        self.service = MedicalService.objects.create(
            name='Standard Eye Exam',
            slug='eye-exam',
            required_specialization='OPTOMETRIST',
            duration_minutes=30
        )

    def test_create_conversation_triage_and_assignment(self):
        """
        Verify conversation creation initializes status as WAITING_FOR_AGENT and routes priority.
        """
        conv = create_conversation(
            patient=self.patient,
            category='APPOINTMENT',
            subject='Regular booking',
            initial_message='I need an appointment.'
        )
        self.assertEqual(conv.status, ConversationStatus.WAITING_FOR_AGENT)
        self.assertEqual(conv.priority, ConversationPriority.NORMAL)
        
        # Test emergency keyword escalation
        emergency_conv = create_conversation(
            patient=self.patient,
            category='CONSULTATION',
            subject='Emergency',
            initial_message='I have sudden vision loss and pain in my left eye.'
        )
        self.assertEqual(emergency_conv.priority, ConversationPriority.URGENT)

    def test_doctor_assignment_workload_validation(self):
        """
        Verify that doctor workload limits and availability status are validated.
        """
        conv = create_conversation(
            patient=self.patient,
            category='CONSULTATION',
            subject='Eye checkup',
            initial_message='Need specialist review.'
        )
        
        # 1. Test busy availability status
        self.doctor_profile.availability_status = 'BUSY'
        self.doctor_profile.save()
        with self.assertRaises(ValidationError):
            assign_conversation(conversation=conv, actor=self.agent, doctor=self.doctor)
            
        # Restore availability
        self.doctor_profile.availability_status = 'AVAILABLE'
        self.doctor_profile.save()
        
        # 2. Test max active conversation limits
        # Assign to 1st conversation
        assign_conversation(conversation=conv, actor=self.agent, doctor=self.doctor)
        self.assertEqual(conv.status, ConversationStatus.WAITING_FOR_DOCTOR)
        self.assertEqual(conv.assigned_doctor, self.doctor)
        
        # Create and assign 2nd conversation
        conv2 = create_conversation(
            patient=self.patient,
            category='CONSULTATION',
            subject='Second request',
            initial_message='More questions.'
        )
        assign_conversation(conversation=conv2, actor=self.agent, doctor=self.doctor)
        
        # Create 3rd conversation -> should raise ValidationError (max limit is 2)
        conv3 = create_conversation(
            patient=self.patient,
            category='CONSULTATION',
            subject='Third request',
            initial_message='Limit test.'
        )
        with self.assertRaises(ValidationError):
            assign_conversation(conversation=conv3, actor=self.agent, doctor=self.doctor)

    def test_assignment_history_audit_trail(self):
        """
        Verify that assigning a doctor creates a ConversationAssignmentHistory record.
        """
        conv = create_conversation(
            patient=self.patient,
            category='CONSULTATION',
            subject='Audit test',
            initial_message='Test history.'
        )
        assign_conversation(conversation=conv, actor=self.agent, doctor=self.doctor, reason="Initial assignment")
        
        # Check history
        history = ConversationAssignmentHistory.objects.filter(conversation=conv)
        self.assertEqual(history.count(), 1)
        record = history.first()
        self.assertEqual(record.assigned_by, self.agent)
        self.assertEqual(record.new_doctor, self.doctor)
        self.assertIsNone(record.previous_doctor)
        self.assertEqual(record.reason, "Initial assignment")

    def test_status_transitions_on_reply(self):
        """
        Verify status transitions from WAITING_FOR_DOCTOR to DOCTOR_ACTIVE upon doctor reply.
        """
        conv = create_conversation(
            patient=self.patient,
            category='CONSULTATION',
            subject='Reply test',
            initial_message='Patient message.'
        )
        assign_conversation(conversation=conv, actor=self.agent, doctor=self.doctor)
        self.assertEqual(conv.status, ConversationStatus.WAITING_FOR_DOCTOR)
        
        # Doctor sends message -> status transitions to DOCTOR_ACTIVE
        send_message(conversation=conv, sender=self.doctor, content="Hello, this is Dr. Eye.")
        conv.refresh_from_db()
        self.assertEqual(conv.status, ConversationStatus.DOCTOR_ACTIVE)
