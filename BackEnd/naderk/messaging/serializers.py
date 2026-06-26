from rest_framework import serializers
from django.contrib.auth import get_user_model
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
    ConversationPriority
)
from .selectors import get_unread_message_count

User = get_user_model()

class UserMinimalSerializer(serializers.ModelSerializer):
    patient_id = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()
    dob = serializers.SerializerMethodField()
    gender = serializers.SerializerMethodField()
    phone_number = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'first_name', 'last_name', 'patient_id', 'avatar', 'dob', 'gender', 'phone_number']

    def get_patient_id(self, obj) -> str | None:
        if hasattr(obj, 'patient_profile') and obj.patient_profile:
            return obj.patient_profile.patient_id
        return None

    def get_avatar(self, obj) -> str | None:
        if obj.role == User.Role.DOCTOR and hasattr(obj, 'doctor_profile') and obj.doctor_profile:
            return obj.doctor_profile.avatar
        return None

    def get_dob(self, obj) -> str | None:
        if obj.role == User.Role.PATIENT:
            if hasattr(obj, 'date_of_birth') and obj.date_of_birth:
                return obj.date_of_birth.isoformat()
            if hasattr(obj, 'patient_profile') and obj.patient_profile and obj.patient_profile.dob:
                return obj.patient_profile.dob.isoformat()
        return None

    def get_gender(self, obj) -> str | None:
        if obj.role == User.Role.PATIENT:
            if hasattr(obj, 'gender') and obj.gender:
                return obj.gender
            if hasattr(obj, 'patient_profile') and obj.patient_profile:
                return obj.patient_profile.gender
        return None

    def get_phone_number(self, obj) -> str | None:
        if hasattr(obj, 'phone_number') and obj.phone_number:
            return obj.phone_number
        if obj.role == User.Role.PATIENT and hasattr(obj, 'patient_profile') and obj.patient_profile:
            return obj.patient_profile.phone_number
        return None

class MessageSerializer(serializers.ModelSerializer):
    sender = UserMinimalSerializer(read_only=True)
    is_read = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = ['id', 'conversation', 'sender', 'content', 'attachment_url', 'is_read', 'created_at']

    def get_is_read(self, obj) -> bool:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return MessageRead.objects.filter(message=obj, user=request.user).exists()

class ConversationSerializer(serializers.ModelSerializer):
    patient = UserMinimalSerializer(read_only=True)
    assigned_agent = UserMinimalSerializer(read_only=True)
    assigned_doctor = UserMinimalSerializer(read_only=True)
    unread_count = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    
    class Meta:
        model = Conversation
        fields = [
            'id', 'patient', 'assigned_agent', 'assigned_doctor', 
            'department', 'category', 'priority', 'subject', 'status', 
            'first_response_at', 'resolved_at', 'is_archived', 'related_appointment', 
            'related_telehealth_session', 'created_at', 'updated_at', 'last_message_at',
            'unread_count', 'last_message'
        ]

    def get_unread_count(self, obj) -> int:
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return get_unread_message_count(user=request.user, conversation=obj)

    def get_last_message(self, obj) -> dict | None:
        last_msg = obj.messages.filter(is_archived=False).order_by('-created_at').first()
        if last_msg:
            return {
                "id": str(last_msg.id),
                "content": last_msg.content,
                "sender_id": str(last_msg.sender.id),
                "sender_role": last_msg.sender.role,
                "created_at": last_msg.created_at.isoformat()
            }
        return None

class InternalNoteSerializer(serializers.ModelSerializer):
    author = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = InternalNote
        fields = ['id', 'conversation', 'author', 'content', 'created_at']

class ConversationActivitySerializer(serializers.ModelSerializer):
    actor = UserMinimalSerializer(read_only=True)
    
    class Meta:
        model = ConversationActivity
        fields = ['id', 'conversation', 'actor', 'action', 'metadata', 'created_at']

class CreateConversationSerializer(serializers.Serializer):
    category = serializers.ChoiceField(choices=MessagingCategory.choices)
    subject = serializers.CharField(max_length=255, required=False, allow_blank=True)
    message = serializers.CharField()
    attachment_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)
    related_appointment_id = serializers.UUIDField(required=False, allow_null=True)

class CreateMessageSerializer(serializers.Serializer):
    content = serializers.CharField()
    attachment_url = serializers.URLField(required=False, allow_blank=True, allow_null=True)

class CreateInternalNoteSerializer(serializers.Serializer):
    content = serializers.CharField()

class AssignConversationSerializer(serializers.Serializer):
    assigned_agent_id = serializers.UUIDField(required=False, allow_null=True)
    assigned_doctor_id = serializers.UUIDField(required=False, allow_null=True)
    department = serializers.ChoiceField(choices=MessagingDepartment.choices, required=False)
    status = serializers.ChoiceField(choices=ConversationStatus.choices, required=False)
    priority = serializers.ChoiceField(choices=ConversationPriority.choices, required=False)
    reason = serializers.CharField(required=False, allow_blank=True, allow_null=True)
