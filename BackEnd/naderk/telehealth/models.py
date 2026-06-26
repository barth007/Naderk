import uuid
from django.db import models
from django.conf import settings

class TelehealthSession(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        WAITING_ROOM = 'WAITING_ROOM', 'Waiting Room'
        WAITING_FOR_DOCTOR = 'WAITING_FOR_DOCTOR', 'Waiting For Doctor'
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        MISSED = 'MISSED', 'Missed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment = models.OneToOneField(
        'appointments.Appointment', 
        on_delete=models.CASCADE, 
        related_name='telehealth_session'
    )
    room_name = models.CharField(max_length=255, unique=True)
    room_id = models.CharField(max_length=255, blank=True, null=True)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='telehealth_sessions_as_patient',
        null=True,
        blank=True
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='telehealth_sessions_as_doctor',
        null=True,
        blank=True
    )
    recording_enabled = models.BooleanField(default=False)
    status = models.CharField(
        max_length=50, 
        choices=Status.choices, 
        default=Status.SCHEDULED
    )
    scheduled_start = models.DateTimeField()
    scheduled_end = models.DateTimeField()
    started_at = models.DateTimeField(blank=True, null=True)
    ended_at = models.DateTimeField(blank=True, null=True)
    duration_minutes = models.PositiveIntegerField(blank=True, null=True)
    conversation = models.ForeignKey(
        'messaging.Conversation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='telehealth_sessions'
    )
    session_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if self.appointment:
            if not self.patient:
                self.patient = self.appointment.patient
            if not self.doctor:
                self.doctor = self.appointment.doctor
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Session for Appointment {self.appointment_id} ({self.status})"


class TelehealthParticipant(models.Model):
    class Role(models.TextChoices):
        PATIENT = 'PATIENT', 'Patient'
        DOCTOR = 'DOCTOR', 'Doctor'

    class ConnectionStatus(models.TextChoices):
        CONNECTED = 'CONNECTED', 'Connected'
        DISCONNECTED = 'DISCONNECTED', 'Disconnected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        TelehealthSession, 
        on_delete=models.CASCADE, 
        related_name='participants'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='telehealth_participations'
    )
    role = models.CharField(max_length=50, choices=Role.choices)
    joined_at = models.DateTimeField(blank=True, null=True)
    left_at = models.DateTimeField(blank=True, null=True)
    connection_status = models.CharField(
        max_length=50, 
        choices=ConnectionStatus.choices, 
        default=ConnectionStatus.DISCONNECTED
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('session', 'user')

    def __str__(self):
        return f"{self.user.email} as {self.role} in {self.session_id}"


class TelehealthEvent(models.Model):
    class EventType(models.TextChoices):
        CREATED = 'CREATED', 'Session created'
        PATIENT_JOINED = 'PATIENT_JOINED', 'Patient joined'
        DOCTOR_JOINED = 'DOCTOR_JOINED', 'Doctor joined'
        STARTED = 'STARTED', 'Session started'
        ENDED = 'ENDED', 'Session ended'
        CANCELLED = 'CANCELLED', 'Session cancelled'
        PATIENT_MISSED = 'PATIENT_MISSED', 'Patient missed'
        DOCTOR_MISSED = 'DOCTOR_MISSED', 'Doctor missed'
        MISSED = 'MISSED', 'Session missed'
        QUALITY_ALERT = 'QUALITY_ALERT', 'Network quality alert'
        RECONNECT = 'RECONNECT', 'Reconnect event'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(
        TelehealthSession, 
        on_delete=models.CASCADE, 
        related_name='events'
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='telehealth_events'
    )
    event_type = models.CharField(max_length=100, choices=EventType.choices)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Event {self.event_type} for {self.session_id}"
