import uuid
from django.db import models
from django.conf import settings
from django.utils.translation import gettext_lazy as _

class MessagingCategory(models.TextChoices):
    APPOINTMENT = 'APPOINTMENT', _('Appointment Booking')
    CONSULTATION = 'CONSULTATION', _('Eye Consultation')
    PRESCRIPTION = 'PRESCRIPTION', _('Prescription Question')
    BILLING = 'BILLING', _('Billing & Payments')
    TELEHEALTH = 'TELEHEALTH', _('Telehealth Support')
    MEDICAL_RECORDS = 'MEDICAL_RECORDS', _('Medical Records')
    INSURANCE = 'INSURANCE', _('Insurance')
    OTHER = 'OTHER', _('Other')

class MessagingDepartment(models.TextChoices):
    GENERAL = 'GENERAL', _('General Care')
    APPOINTMENTS = 'APPOINTMENTS', _('Appointments')
    OPHTHALMOLOGY = 'OPHTHALMOLOGY', _('Ophthalmology')
    OPTOMETRY = 'OPTOMETRY', _('Optometry')
    BILLING = 'BILLING', _('Billing')
    TELEHEALTH = 'TELEHEALTH', _('Telehealth')
    MEDICAL_RECORDS = 'MEDICAL_RECORDS', _('Medical Records')
    INSURANCE = 'INSURANCE', _('Insurance')

class ConversationStatus(models.TextChoices):
    WAITING_FOR_AGENT = 'WAITING_FOR_AGENT', _('Waiting for Agent')
    AGENT_ACTIVE = 'AGENT_ACTIVE', _('Agent Active')
    WAITING_FOR_DOCTOR = 'WAITING_FOR_DOCTOR', _('Waiting for Doctor')
    DOCTOR_ACTIVE = 'DOCTOR_ACTIVE', _('Doctor Active')
    CLOSED = 'CLOSED', _('Closed')

class ConversationClosedReason(models.TextChoices):
    RESOLVED = 'RESOLVED', _('Resolved')
    APPOINTMENT_BOOKED = 'APPOINTMENT_BOOKED', _('Appointment Booked')
    TELEHEALTH_COMPLETED = 'TELEHEALTH_COMPLETED', _('Telehealth Completed')
    NO_RESPONSE = 'NO_RESPONSE', _('No Response')
    DUPLICATE = 'DUPLICATE', _('Duplicate')
    ESCALATED_ELSEWHERE = 'ESCALATED_ELSEWHERE', _('Escalated Elsewhere')

class ConversationPriority(models.TextChoices):
    LOW = 'LOW', _('Low')
    NORMAL = 'NORMAL', _('Normal')
    HIGH = 'HIGH', _('High')
    URGENT = 'URGENT', _('Urgent')

class ParticipantRole(models.TextChoices):
    PATIENT = 'PATIENT', _('Patient')
    AGENT = 'AGENT', _('Agent')
    DOCTOR = 'DOCTOR', _('Doctor')

class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='conversations_as_patient'
    )
    assigned_agent = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='conversations_as_agent'
    )
    assigned_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='conversations_as_doctor'
    )
    
    department = models.CharField(
        max_length=50, 
        choices=MessagingDepartment.choices, 
        default=MessagingDepartment.GENERAL
    )
    category = models.CharField(
        max_length=50, 
        choices=MessagingCategory.choices, 
        default=MessagingCategory.OTHER
    )
    priority = models.CharField(
        max_length=50, 
        choices=ConversationPriority.choices, 
        default=ConversationPriority.NORMAL
    )
    subject = models.CharField(max_length=255, blank=True, null=True)
    status = models.CharField(
        max_length=50, 
        choices=ConversationStatus.choices, 
        default=ConversationStatus.WAITING_FOR_AGENT
    )
    closed_reason = models.CharField(
        max_length=50, 
        choices=ConversationClosedReason.choices, 
        blank=True, 
        null=True
    )
    
    first_response_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    
    related_appointment = models.ForeignKey(
        'appointments.Appointment', 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='conversations'
    )
    related_telehealth_session = models.CharField(max_length=255, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-last_message_at']
        indexes = [
            models.Index(fields=['patient']),
            models.Index(fields=['assigned_agent']),
            models.Index(fields=['assigned_doctor']),
            models.Index(fields=['status']),
            models.Index(fields=['department']),
            models.Index(fields=['is_archived']),
        ]

    def __str__(self):
        return f"{self.subject or self.category} - {self.patient.email} ({self.status})"

class MessageType(models.TextChoices):
    TEXT = 'TEXT', _('Text')
    IMAGE = 'IMAGE', _('Image')
    FILE = 'FILE', _('File')
    SYSTEM = 'SYSTEM', _('System')

class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='messages'
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='sent_messages'
    )
    content = models.TextField()
    attachment_url = models.URLField(blank=True, null=True)
    
    message_type = models.CharField(
        max_length=20, 
        choices=MessageType.choices, 
        default=MessageType.TEXT
    )
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation']),
            models.Index(fields=['sender']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Msg from {self.sender.email} in {self.conversation.id}"

class MessageRead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(
        Message, 
        on_delete=models.CASCADE, 
        related_name='reads'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='message_reads'
    )
    read_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('message', 'user')

    def __str__(self):
        return f"{self.user.email} read {self.message.id}"

class ConversationParticipant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='participants'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='conversation_participations'
    )
    role = models.CharField(
        max_length=50, 
        choices=ParticipantRole.choices, 
        default=ParticipantRole.PATIENT
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('conversation', 'user')

    def __str__(self):
        return f"{self.user.email} as {self.role} in {self.conversation.id}"

class ConversationActivity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='activities'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='conversation_activities'
    )
    action = models.CharField(max_length=100)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.action} on {self.conversation.id} by {self.actor.email if self.actor else 'System'}"

class InternalNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(
        Conversation, 
        on_delete=models.CASCADE, 
        related_name='internal_notes'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='internal_notes_written'
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Note by {self.author.email} on {self.conversation.id}"

class MessageAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name='attachments')
    file_url = models.URLField(max_length=1000)
    file_type = models.CharField(max_length=50)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attachment for {self.message.id} ({self.file_type})"

class ConversationAssignmentHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='assignment_history')
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='assigned_conversations_history'
    )
    previous_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='previous_assigned_doctor_history'
    )
    new_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='new_assigned_doctor_history'
    )
    reason = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Handoff of {self.conversation_id} to Dr. {self.new_doctor.last_name} at {self.created_at}"
