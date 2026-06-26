from django.db.models import QuerySet, Q, OuterRef, Exists, Case, When, Value, IntegerField
from django.contrib.auth import get_user_model
from .models import (
    Conversation, 
    Message, 
    MessageRead, 
    ConversationParticipant, 
    ConversationActivity, 
    InternalNote,
    ConversationStatus
)

User = get_user_model()

def get_user_conversations(user: User) -> QuerySet:
    """
    Returns non-archived conversations based on user roles:
    - Patients see their own conversations.
    - Agents & Admins see all active queue conversations.
    - Doctors see conversations assigned to them, ordered by priority and date.
    """
    if user.role == User.Role.PATIENT:
        return Conversation.objects.filter(patient=user, is_archived=False)
    elif user.role in [User.Role.MEDICAL_AGENT, User.Role.AGENT, User.Role.ADMIN, User.Role.SUPER_ADMIN]:
        return Conversation.objects.filter(is_archived=False).exclude(status=ConversationStatus.CLOSED)
    elif user.role == User.Role.DOCTOR:
        return Conversation.objects.filter(
            assigned_doctor=user,
            is_archived=False
        ).annotate(
            priority_order=Case(
                When(priority='URGENT', then=Value(1)),
                When(priority='HIGH', then=Value(2)),
                When(priority='NORMAL', then=Value(3)),
                When(priority='LOW', then=Value(4)),
                default=Value(5),
                output_field=IntegerField()
            )
        ).order_by('priority_order', 'created_at')
    return Conversation.objects.none()

def get_conversation_messages(conversation: Conversation, user: User) -> QuerySet:
    """
    Returns messages in a conversation. Asserts participant access.
    """
    # Check if user has access to conversation
    is_staff = user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
    has_access = is_staff or conversation.patient == user or conversation.participants.filter(user=user).exists()
    
    if not has_access:
        raise PermissionError("Access to this conversation is denied.")
        
    return Message.objects.filter(conversation=conversation, is_archived=False)

def get_conversation_activities(conversation: Conversation, user: User) -> QuerySet:
    """
    Returns activities. Only staff can access conversation activities for triage tracking.
    """
    is_staff = user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
    if not is_staff and conversation.patient != user:
        raise PermissionError("Access denied.")
    return ConversationActivity.objects.filter(conversation=conversation)

def get_conversation_internal_notes(conversation: Conversation, user: User) -> QuerySet:
    """
    Returns internal notes. Patients can never view internal notes.
    """
    is_staff = user.role in [User.Role.AGENT, User.Role.DOCTOR, User.Role.ADMIN]
    if not is_staff:
        raise PermissionError("Access to internal notes is restricted to clinical staff.")
    return InternalNote.objects.filter(conversation=conversation)

def get_unread_message_count(user: User, conversation: Conversation = None) -> int:
    """
    Returns count of unread messages for a given user.
    Filtered by specific conversation, or summed across all active conversations.
    """
    # Subquery to check if a MessageRead exists for the message & user
    reads_subquery = MessageRead.objects.filter(
        message=OuterRef('pk'),
        user=user
    )
    
    unread_messages = Message.objects.filter(
        is_archived=False
    ).exclude(
        sender=user
    ).annotate(
        already_read=Exists(reads_subquery)
    ).filter(
        already_read=False
    )
    
    if conversation:
        unread_messages = unread_messages.filter(conversation=conversation)
    else:
        # Limit to conversations the user actually participates in
        user_convs = get_user_conversations(user)
        unread_messages = unread_messages.filter(conversation__in=user_convs)
        
    return unread_messages.count()
