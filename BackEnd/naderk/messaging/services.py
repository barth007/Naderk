from naderk.common.storage.service import storage_service
import datetime
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from django.core.exceptions import ValidationError
from .models import (
    Conversation, 
    Message, 
    MessageRead, 
    ConversationParticipant, 
    ConversationActivity, 
    InternalNote,
    MessagingCategory,
    MessagingDepartment,
    ConversationStatus,
    ConversationPriority,
    ParticipantRole,
    ConversationClosedReason,
    MessageType,
    MessageAttachment,
    ConversationAssignmentHistory
)
from naderk.notifications.services import create_notification

User = get_user_model()

def assign_best_agent() -> User | None:
    """
    Returns the active agent with the least workload (fewest active conversations).
    Active conversation statuses are OPEN, ASSIGNED, IN_PROGRESS, ESCALATED.
    """
    agents = User.objects.filter(
        Q(role=User.Role.AGENT) | Q(role=User.Role.ADMIN),
        is_active=True
    )
    if not agents.exists():
        return None
        
    # Annotate agents with count of their active conversations
    active_statuses = [
        ConversationStatus.WAITING_FOR_AGENT,
        ConversationStatus.AGENT_ACTIVE,
    ]
    
    agent_workloads = agents.annotate(
        active_conv_count=Count(
            'conversations_as_agent',
            filter=Q(conversations_as_agent__status__in=active_statuses)
        )
    ).order_by('active_conv_count')
    
    return agent_workloads.first()

@transaction.atomic
def create_conversation(
    *, 
    patient: User, 
    category: str, 
    subject: str, 
    initial_message: str, 
    attachment_url: str = None,
    related_appointment_id: str = None
) -> Conversation:
    """
    Creates a new conversation, applies automated triage, assigns the best agent,
    logs the activity, and sends the initial message.
    """
    # 1. Triage routing maps category -> (department, default_priority)
    triage_mapping = {
        MessagingCategory.APPOINTMENT: (MessagingDepartment.APPOINTMENTS, ConversationPriority.NORMAL),
        MessagingCategory.CONSULTATION: (MessagingDepartment.OPTOMETRY, ConversationPriority.NORMAL),
        MessagingCategory.PRESCRIPTION: (MessagingDepartment.OPTOMETRY, ConversationPriority.HIGH),
        MessagingCategory.BILLING: (MessagingDepartment.BILLING, ConversationPriority.LOW),
        MessagingCategory.TELEHEALTH: (MessagingDepartment.TELEHEALTH, ConversationPriority.NORMAL),
        MessagingCategory.MEDICAL_RECORDS: (MessagingDepartment.MEDICAL_RECORDS, ConversationPriority.LOW),
        MessagingCategory.INSURANCE: (MessagingDepartment.INSURANCE, ConversationPriority.LOW),
        MessagingCategory.OTHER: (MessagingDepartment.GENERAL, ConversationPriority.LOW),
    }
    
    dept, priority = triage_mapping.get(category, (MessagingDepartment.GENERAL, ConversationPriority.NORMAL))
    
    # Advanced triage: Detect urgent keywords for ocular emergencies
    urgent_keywords = ["loss", "vision loss", "sudden", "blind", "pain", "injury", "accident", "blood", "bleed"]
    content_to_check = f"{subject} {initial_message}".lower()
    if any(kw in content_to_check for kw in urgent_keywords):
        priority = ConversationPriority.URGENT
        
    # 2. Workload-balanced agent assignment
    agent = assign_best_agent()
    status = ConversationStatus.WAITING_FOR_AGENT
    
    # 3. Create Conversation
    conversation = Conversation.objects.create(
        patient=patient,
        assigned_agent=agent,
        department=dept,
        category=category,
        priority=priority,
        subject=subject,
        status=status,
        related_appointment_id=related_appointment_id
    )
    
    # 4. Register Participants
    ConversationParticipant.objects.create(
        conversation=conversation,
        user=patient,
        role=ParticipantRole.PATIENT
    )
    
    if agent:
        ConversationParticipant.objects.create(
            conversation=conversation,
            user=agent,
            role=ParticipantRole.AGENT
        )
        
    # 5. Log Activities
    create_conversation_activity(
        conversation=conversation,
        actor=patient,
        action="CREATED",
        metadata={"category": category, "department": dept, "priority": priority}
    )
    
    if agent:
        create_conversation_activity(
            conversation=conversation,
            actor=None, # System action
            action="ASSIGNED_AGENT",
            metadata={"agent_id": str(agent.id), "agent_email": agent.email}
        )
        # Notify the agent
        create_notification(
            user=agent,
            title="New Triage Conversation",
            message=f"A new conversation ({category}) has been triaged and assigned to you.",
            conversation=conversation
        )
        
    # 6. Send Initial Message
    send_message(
        conversation=conversation,
        sender=patient,
        content=initial_message,
        attachment_url=attachment_url
    )
    
    return conversation

@transaction.atomic
def send_message(
    *,
    conversation: Conversation,
    sender: User,
    content: str,
    attachment_url: str = None
) -> Message:
    """
    Saves a message in the conversation, updates activity time, handles read status,
    triggers notification updates, and broadcasts to WebSocket groups.
    """
    # Reopen conversation if closed and patient sends message
    is_staff = sender.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
    
    if not is_staff and conversation.status == ConversationStatus.CLOSED:
        conversation.status = ConversationStatus.WAITING_FOR_AGENT
        conversation.save()
        create_conversation_activity(
            conversation=conversation,
            actor=sender,
            action="REOPENED",
            metadata={"reason": "Patient sent a new message"}
        )
        
    # Transition status when staff responds
    if sender.role in [User.Role.AGENT, User.Role.ADMIN] and conversation.status == ConversationStatus.WAITING_FOR_AGENT:
        conversation.status = ConversationStatus.AGENT_ACTIVE
        if not conversation.first_response_at:
            conversation.first_response_at = timezone.now()
        conversation.save()
        create_conversation_activity(
            conversation=conversation,
            actor=sender,
            action="AGENT_RESPONDED",
            metadata={"agent_id": str(sender.id)}
        )
    elif sender.role == User.Role.DOCTOR and conversation.status == ConversationStatus.WAITING_FOR_DOCTOR:
        conversation.status = ConversationStatus.DOCTOR_ACTIVE
        if not conversation.first_response_at:
            conversation.first_response_at = timezone.now()
        conversation.save()
        create_conversation_activity(
            conversation=conversation,
            actor=sender,
            action="DOCTOR_RESPONDED",
            metadata={"doctor_id": str(sender.id)}
        )
        
    # Create Message
    message = Message.objects.create(
        conversation=conversation,
        sender=sender,
        content=content,
        attachment_url=attachment_url,
        message_type=MessageType.IMAGE if (attachment_url and attachment_url.lower().endswith(('.png', '.jpg', '.jpeg', '.gif'))) else (MessageType.FILE if attachment_url else MessageType.TEXT)
    )
    if attachment_url:
        file_ext = attachment_url.split('.')[-1].lower() if '.' in attachment_url else 'unknown'
        MessageAttachment.objects.create(
            message=message,
            file_url=attachment_url,
            file_type=file_ext
        )
    
    # Update last activity
    conversation.last_message_at = message.created_at
    conversation.save()
    
    # Auto-read for the sender
    MessageRead.objects.create(
        message=message,
        user=sender
    )
    
    # Create notifications for other active participants
    participants = ConversationParticipant.objects.filter(conversation=conversation).exclude(user=sender)
    for p in participants:
        # Resolve notification message
        msg_title = "New Message from Care Team" if is_staff else "New Patient Message"
        create_notification(
            user=p.user,
            title=msg_title,
            message=content[:100] + ("..." if len(content) > 100 else ""),
            conversation=conversation
        )
        
    # Broadcast to WebSocket Channel Layer
    _broadcast_message_ws(message)
    
    return message

@transaction.atomic
def create_internal_note(
    *,
    conversation: Conversation,
    author: User,
    content: str
) -> InternalNote:
    """
    Saves a private staff note, logs activity, and broadcasts to staff members.
    """
    if author.role not in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]:
        raise ValueError("Only staff can leave internal notes.")
        
    note = InternalNote.objects.create(
        conversation=conversation,
        author=author,
        content=content
    )
    
    create_conversation_activity(
        conversation=conversation,
        actor=author,
        action="NOTE_ADDED",
        metadata={"note_id": str(note.id)}
    )
    
    # Broadcast update to websocket for staff members only
    _broadcast_internal_note_ws(note)
    
    return note

@transaction.atomic
def assign_conversation(
    *,
    conversation: Conversation,
    actor: User,
    agent: User = None,
    doctor: User = None,
    department: str = None,
    status: str = None,
    priority: str = None,
    reason: str = None
) -> Conversation:
    """
    Updates conversation fields, registers participants, records activities,
    sends notifications, and broadcasts updates via channels.
    """
    metadata = {}
    
    if agent:
        conversation.assigned_agent = agent
        conversation.status = ConversationStatus.AGENT_ACTIVE
        ConversationParticipant.objects.get_or_create(
            conversation=conversation,
            user=agent,
            defaults={'role': ParticipantRole.AGENT}
        )
        create_conversation_activity(
            conversation=conversation,
            actor=actor,
            action="ASSIGNED_AGENT",
            metadata={"agent_id": str(agent.id), "agent_email": agent.email}
        )
        create_notification(
            user=agent,
            title="Conversation Assigned",
            message=f"You have been assigned to conversation: {conversation.subject or conversation.category}",
            conversation=conversation
        )
        
    if doctor:
        from naderk.users.models import DoctorProfile
        from naderk.telehealth.models import TelehealthSession
        from naderk.appointments.models import Appointment

        try:
            doctor_profile = DoctorProfile.objects.get(user=doctor)
        except DoctorProfile.DoesNotExist:
            raise ValidationError("Doctor profile does not exist.")

        if doctor_profile.availability_status == 'BUSY' or not doctor_profile.is_accepting_patients:
            raise ValidationError("Doctor is busy or not accepting new patients.")

        today = timezone.localdate()
        today_appointments_count = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=today
        ).count()
        if today_appointments_count >= doctor_profile.max_daily_patients:
            raise ValidationError(f"Doctor has reached the maximum appointment limit of {doctor_profile.max_daily_patients} patients for today.")

        doctor_active_conversations = Conversation.objects.filter(
            assigned_doctor=doctor,
            status__in=[ConversationStatus.WAITING_FOR_DOCTOR, ConversationStatus.DOCTOR_ACTIVE]
        ).count()
        if doctor_active_conversations >= doctor_profile.max_active_conversations:
            raise ValidationError(f"Doctor has reached the maximum limit of {doctor_profile.max_active_conversations} active conversations.")

        active_sessions_count = TelehealthSession.objects.filter(
            doctor=doctor,
            status__in=[
                TelehealthSession.Status.WAITING_ROOM,
                TelehealthSession.Status.WAITING_FOR_DOCTOR,
                TelehealthSession.Status.ACTIVE
            ]
        ).count()
        if active_sessions_count >= doctor_profile.max_active_telehealth_sessions:
            raise ValidationError(f"Doctor has reached the maximum limit of {doctor_profile.max_active_telehealth_sessions} active telehealth sessions.")

        previous_doctor = conversation.assigned_doctor
        conversation.assigned_doctor = doctor
        conversation.status = ConversationStatus.WAITING_FOR_DOCTOR

        ConversationAssignmentHistory.objects.create(
            conversation=conversation,
            assigned_by=actor,
            previous_doctor=previous_doctor,
            new_doctor=doctor,
            reason=reason
        )

        ConversationParticipant.objects.get_or_create(
            conversation=conversation,
            user=doctor,
            defaults={'role': ParticipantRole.DOCTOR}
        )
        create_conversation_activity(
            conversation=conversation,
            actor=actor,
            action="ESCALATED_DOCTOR",
            metadata={"doctor_id": str(doctor.id), "doctor_email": doctor.email}
        )
        create_notification(
            user=doctor,
            title="Medical Escalation",
            message=f"A conversation has been escalated to you: {conversation.subject or conversation.category}",
            conversation=conversation
        )
        
    if department:
        old_dept = conversation.department
        conversation.department = department
        create_conversation_activity(
            conversation=conversation,
            actor=actor,
            action="DEPARTMENT_CHANGED",
            metadata={"old_department": old_dept, "new_department": department}
        )
        
    if status:
        old_status = conversation.status
        conversation.status = status
        if status == ConversationStatus.CLOSED:
            conversation.resolved_at = timezone.now()
            if not conversation.closed_reason:
                conversation.closed_reason = ConversationClosedReason.RESOLVED
        create_conversation_activity(
            conversation=conversation,
            actor=actor,
            action="STATUS_CHANGED",
            metadata={"old_status": old_status, "new_status": status}
        )
        
    if priority:
        old_priority = conversation.priority
        conversation.priority = priority
        create_conversation_activity(
            conversation=conversation,
            actor=actor,
            action="PRIORITY_CHANGED",
            metadata={"old_priority": old_priority, "new_priority": priority}
        )
        
    conversation.save()
    
    # Broadcast general update
    _broadcast_conversation_update_ws(conversation)
    
    return conversation

@transaction.atomic
def resolve_conversation(*, conversation: Conversation, actor: User) -> Conversation:
    """
    Marks a conversation as resolved, records activity, sends notification, and broadcasts.
    """
    old_status = conversation.status
    conversation.status = ConversationStatus.CLOSED
    conversation.closed_reason = ConversationClosedReason.RESOLVED
    conversation.resolved_at = timezone.now()
    conversation.save()
    
    create_conversation_activity(
        conversation=conversation,
        actor=actor,
        action="STATUS_CHANGED",
        metadata={"old_status": old_status, "new_status": ConversationStatus.CLOSED}
    )
    
    # Notify patient
    create_notification(
        user=conversation.patient,
        title="Conversation Resolved",
        message=f"Your conversation regarding {conversation.subject or conversation.category} has been marked as resolved.",
        conversation=conversation
    )
    
    _broadcast_conversation_update_ws(conversation)
    return conversation

def create_conversation_activity(conversation, actor, action, metadata=None):
    return ConversationActivity.objects.create(
        conversation=conversation,
        actor=actor,
        action=action,
        metadata=metadata or {}
    )

def upload_attachment(file) -> str:
    result = storage_service.upload_file(file, bucket_type='public', prefix='messaging')
    return result.url

# WebSocket Broadcasters
def _broadcast_message_ws(message: Message):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
        
    conversation = message.conversation
    message_data = {
        "id": str(message.id),
        "conversation": str(conversation.id),  # matches Message.conversation field in the frontend type
        "sender": {
            "id": str(message.sender.id),
            "email": message.sender.email,
            "role": message.sender.role,
            "first_name": message.sender.first_name,
            "last_name": message.sender.last_name,
        },
        "content": message.content,
        "attachment_url": message.attachment_url,
        "created_at": message.created_at.isoformat(),
    }
    
    # Group room broadcast
    async_to_sync(channel_layer.group_send)(
        f"conversation_{conversation.id}",
        {
            "type": "chat_message",
            "message": message_data
        }
    )
    
    # Notify individual users on their lists
    participants = ConversationParticipant.objects.filter(conversation=conversation)
    for p in participants:
        async_to_sync(channel_layer.group_send)(
            f"user_{p.user.id}",
            {
                "type": "conversation_update",
                "conversation": {
                    "id": str(conversation.id),
                    "status": conversation.status,
                    "last_message": message.content[:60],
                    "last_message_at": conversation.last_message_at.isoformat()
                }
            }
        )

def _broadcast_internal_note_ws(note: InternalNote):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
        
    async_to_sync(channel_layer.group_send)(
        f"conversation_{note.conversation.id}",
        {
            "type": "internal_note",
            "note": {
                "id": str(note.id),
                "author": note.author.email,
                "content": note.content,
                "created_at": note.created_at.isoformat()
            }
        }
    )

def _broadcast_conversation_update_ws(conversation: Conversation):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return
        
    participants = ConversationParticipant.objects.filter(conversation=conversation)
    for p in participants:
        async_to_sync(channel_layer.group_send)(
            f"user_{p.user.id}",
            {
                "type": "conversation_details_update",
                "conversation": {
                    "id": str(conversation.id),
                    "status": conversation.status,
                    "department": conversation.department,
                    "priority": conversation.priority,
                    "assigned_agent": conversation.assigned_agent.email if conversation.assigned_agent else None,
                    "assigned_doctor": conversation.assigned_doctor.email if conversation.assigned_doctor else None,
                }
            }
        )
