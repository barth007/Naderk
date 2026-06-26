import os
import django
import sys

# Setup django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from naderk.core.models import User
from naderk.messaging.models import (
    Conversation, 
    Message, 
    MessageRead, 
    ConversationParticipant, 
    ConversationActivity, 
    InternalNote,
    MessagingCategory,
    MessagingDepartment,
    ConversationStatus,
    ConversationPriority
)
from naderk.messaging.services import (
    create_conversation, 
    send_message, 
    create_internal_note, 
    assign_conversation, 
    resolve_conversation
)
from naderk.messaging.selectors import get_unread_message_count

def run_test():
    print("Starting messaging system tests...")
    
    # 1. Setup users
    patient_email = "patient_test@example.com"
    agent_email = "agent_test@example.com"
    doctor_email = "doctor_test@example.com"
    
    # Delete if exists
    User.objects.filter(email__in=[patient_email, agent_email, doctor_email]).delete()
    
    patient = User.objects.create_user(
        email=patient_email,
        password="password123",
        first_name="Alice",
        last_name="Patient",
        role=User.Role.PATIENT,
        is_verified=True,
        otp_verified=True
    )
    
    agent = User.objects.create_user(
        email=agent_email,
        password="password123",
        first_name="Bob",
        last_name="Agent",
        role=User.Role.AGENT,
        is_verified=True,
        otp_verified=True
    )
    
    doctor = User.objects.create_user(
        email=doctor_email,
        password="password123",
        first_name="Dr. Charles",
        last_name="Doctor",
        role=User.Role.DOCTOR,
        is_verified=True,
        otp_verified=True
    )
    
    print("Users created successfully.")
    
    # 2. Create conversation (triage mapping & agent workload balancing)
    print("\nTesting conversation creation and triage...")
    conv = create_conversation(
        patient=patient,
        category=MessagingCategory.PRESCRIPTION,
        subject="Eye Drop Renewal",
        initial_message="I need a new prescription for my dry eye drops."
    )
    
    # Assertions
    assert conv.patient == patient
    # Should automatically triage PRESCRIPTION to OPTOMETRY and HIGH priority
    assert conv.department == MessagingDepartment.OPTOMETRY
    assert conv.priority == ConversationPriority.HIGH
    # Should assign to Bob Agent (since he is the only active agent/admin)
    assert conv.assigned_agent == agent
    assert conv.status == ConversationStatus.ASSIGNED
    
    print(f"Conversation created: {conv}")
    print(f"Assigned Agent: {conv.assigned_agent.email}")
    print(f"Department: {conv.department}, Priority: {conv.priority}")
    
    # Verify participant records
    participants = ConversationParticipant.objects.filter(conversation=conv)
    assert participants.filter(user=patient, role="PATIENT").exists()
    assert participants.filter(user=agent, role="AGENT").exists()
    print("Conversation participants verified.")
    
    # Verify initial message
    messages = Message.objects.filter(conversation=conv)
    assert messages.count() == 1
    msg1 = messages.first()
    assert msg1.sender == patient
    assert msg1.content == "I need a new prescription for my dry eye drops."
    print("Initial message verified.")
    
    # Verify initial message was auto-read by patient
    assert MessageRead.objects.filter(message=msg1, user=patient).exists()
    assert not MessageRead.objects.filter(message=msg1, user=agent).exists()
    
    # Unread count check
    assert get_unread_message_count(agent, conv) == 1
    assert get_unread_message_count(patient, conv) == 0
    print("Read receipts and unread counts verified.")
    
    # 3. Test sending message & notifications
    print("\nTesting sending message and status reopening...")
    # Resolve first
    resolve_conversation(conversation=conv, actor=agent)
    assert conv.status == ConversationStatus.RESOLVED
    print("Conversation marked RESOLVED.")
    
    # Patient sends message, should reopen
    msg2 = send_message(
        conversation=conv,
        sender=patient,
        content="Actually, I also have some redness in my left eye."
    )
    conv.refresh_from_db()
    assert conv.status == ConversationStatus.OPEN
    print("Conversation successfully REOPENED on patient message.")
    
    # Agent responds, should set first_response_at and IN_PROGRESS status
    msg3 = send_message(
        conversation=conv,
        sender=agent,
        content="Hello Alice, I can help you with that. Let me look at your record."
    )
    conv.refresh_from_db()
    assert conv.status == ConversationStatus.IN_PROGRESS
    assert conv.first_response_at is not None
    print("Conversation status updated to IN_PROGRESS upon agent reply.")
    
    # 4. Testing Internal Notes
    print("\nTesting internal note logging...")
    note = create_internal_note(
        conversation=conv,
        author=agent,
        content="Escalated: Patient reports redness in left eye. Checking records."
    )
    assert note.conversation == conv
    assert note.author == agent
    assert note.content == "Escalated: Patient reports redness in left eye. Checking records."
    
    # Verify patient cannot see it (selector check)
    try:
        from naderk.messaging.selectors import get_conversation_internal_notes
        get_conversation_internal_notes(conv, patient)
        raise AssertionError("Patient was able to retrieve internal note!")
    except PermissionError:
        print("Internal note security access check passed.")
        
    # 5. Testing doctor escalation
    print("\nTesting doctor escalation...")
    conv = assign_conversation(
        conversation=conv,
        actor=agent,
        doctor=doctor
    )
    assert conv.assigned_doctor == doctor
    assert conv.status == ConversationStatus.ESCALATED
    
    participants = ConversationParticipant.objects.filter(conversation=conv)
    assert participants.filter(user=doctor, role="DOCTOR").exists()
    print("Doctor escalated successfully.")
    
    # Cleanup
    User.objects.filter(email__in=[patient_email, agent_email, doctor_email]).delete()
    print("\nAll tests passed successfully!")

if __name__ == "__main__":
    run_test()
