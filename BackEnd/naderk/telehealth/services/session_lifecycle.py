from django.utils import timezone
from naderk.telehealth.models import TelehealthSession, TelehealthParticipant, TelehealthEvent
from naderk.appointments.models import Appointment
from naderk.notifications.services import create_notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

def join_session(*, session: TelehealthSession, user) -> TelehealthParticipant:
    """
    Handles a participant joining a telehealth session.
    Logs events, updates session status, and syncs appointment state.
    """
    appointment = session.appointment
    
    # Determine role
    if user.id == appointment.patient.id:
        role = TelehealthParticipant.Role.PATIENT
        event_type = TelehealthEvent.EventType.PATIENT_JOINED
    elif user.id == appointment.doctor.id:
        role = TelehealthParticipant.Role.DOCTOR
        event_type = TelehealthEvent.EventType.DOCTOR_JOINED
    else:
        role = TelehealthParticipant.Role.DOCTOR if user.role == 'DOCTOR' else TelehealthParticipant.Role.PATIENT
        event_type = TelehealthEvent.EventType.PATIENT_JOINED  # Fallback

    # Get or create participant record
    participant, created = TelehealthParticipant.objects.get_or_create(
        session=session,
        user=user,
        defaults={'role': role}
    )
    
    participant.connection_status = TelehealthParticipant.ConnectionStatus.CONNECTED
    if not participant.joined_at:
        participant.joined_at = timezone.now()
    participant.save(update_fields=['connection_status', 'joined_at'])

    # Write Audit Event
    TelehealthEvent.objects.create(
        session=session,
        actor=user,
        event_type=event_type,
        metadata={'joined_at': participant.joined_at.isoformat()}
    )

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"telehealth_{session.id}",
            {
                "type": "participant_joined",
                "session_id": str(session.id),
                "role": role,
                "user": {
                    "id": str(user.id),
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name
                }
            }
        )

    # Presence-based State Transition Logic
    patient_connected = TelehealthParticipant.objects.filter(
        session=session,
        role=TelehealthParticipant.Role.PATIENT,
        connection_status=TelehealthParticipant.ConnectionStatus.CONNECTED
    ).exists()
    
    doctor_connected = TelehealthParticipant.objects.filter(
        session=session,
        role=TelehealthParticipant.Role.DOCTOR,
        connection_status=TelehealthParticipant.ConnectionStatus.CONNECTED
    ).exists()
    
    old_status = session.status
    if patient_connected and doctor_connected:
        session.status = TelehealthSession.Status.ACTIVE
        if not session.started_at:
            session.started_at = timezone.now()
    elif patient_connected:
        session.status = TelehealthSession.Status.WAITING_ROOM
    elif doctor_connected:
        session.status = TelehealthSession.Status.WAITING_FOR_DOCTOR
    else:
        session.status = TelehealthSession.Status.SCHEDULED

    # If status changed to ACTIVE, sync to appointment and log started event
    if session.status == TelehealthSession.Status.ACTIVE and old_status != TelehealthSession.Status.ACTIVE:
        if not session.started_at:
            session.started_at = timezone.now()
        session.save(update_fields=['status', 'started_at'])
        
        # Log active session start event
        TelehealthEvent.objects.create(
            session=session,
            actor=None,
            event_type=TelehealthEvent.EventType.STARTED,
            metadata={'started_at': session.started_at.isoformat()}
        )

        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"telehealth_{session.id}",
                {
                    "type": "session_started",
                    "session_id": str(session.id),
                    "started_at": session.started_at.isoformat()
                }
            )
        
        # Sync Appointment Status
        if appointment.status != Appointment.Status.IN_PROGRESS:
            appointment.status = Appointment.Status.IN_PROGRESS
            appointment.started_at = session.started_at
            appointment.save(update_fields=['status', 'started_at'])

        # Notify patient
        create_notification(
            user=appointment.patient,
            title="Consultation Started",
            message=f"Dr. {appointment.doctor.last_name} has joined the telehealth room. Your consultation is now active.",
            conversation=session.conversation
        )
    else:
        session.save(update_fields=['status'])

    return participant

def leave_session(*, session: TelehealthSession, user) -> TelehealthParticipant:
    """
    Handles a participant leaving/disconnecting from a session.
    """
    try:
        participant = TelehealthParticipant.objects.get(session=session, user=user)
        participant.connection_status = TelehealthParticipant.ConnectionStatus.DISCONNECTED
        participant.left_at = timezone.now()
        participant.save(update_fields=['connection_status', 'left_at'])

        event_type = TelehealthEvent.EventType.PATIENT_JOINED # Fallback
        if participant.role == TelehealthParticipant.Role.PATIENT:
            msg = "Patient left room"
        else:
            msg = "Doctor left room"

        TelehealthEvent.objects.create(
            session=session,
            actor=user,
            event_type=TelehealthEvent.EventType.RECONNECT if participant.connection_status == TelehealthParticipant.ConnectionStatus.DISCONNECTED else TelehealthEvent.EventType.ENDED,
            metadata={'message': msg, 'left_at': participant.left_at.isoformat()}
        )

        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"telehealth_{session.id}",
                {
                    "type": "participant_left",
                    "session_id": str(session.id),
                    "role": participant.role,
                    "user": {
                        "id": str(user.id),
                        "email": user.email,
                        "first_name": user.first_name,
                        "last_name": user.last_name
                    }
                }
            )
        
        # Update presence status when someone leaves
        patient_connected = TelehealthParticipant.objects.filter(
            session=session,
            role=TelehealthParticipant.Role.PATIENT,
            connection_status=TelehealthParticipant.ConnectionStatus.CONNECTED
        ).exists()
        
        doctor_connected = TelehealthParticipant.objects.filter(
            session=session,
            role=TelehealthParticipant.Role.DOCTOR,
            connection_status=TelehealthParticipant.ConnectionStatus.CONNECTED
        ).exists()
        
        if not patient_connected and not doctor_connected:
            session.status = TelehealthSession.Status.SCHEDULED
        elif patient_connected and not doctor_connected:
            session.status = TelehealthSession.Status.WAITING_ROOM
        elif doctor_connected and not patient_connected:
            session.status = TelehealthSession.Status.WAITING_FOR_DOCTOR
        session.save(update_fields=['status'])
        
        return participant
    except TelehealthParticipant.DoesNotExist:
        return None

def end_session(*, session: TelehealthSession, user) -> TelehealthSession:
    """
    Ends a telehealth session (Doctor or Staff only).
    """
    if user.role not in ['DOCTOR', 'ADMIN', 'AGENT', 'MEDICAL_AGENT'] and user.id != session.appointment.doctor.id:
        raise PermissionError("Access Denied: Only doctors or staff members can end the session.")

    if session.status == TelehealthSession.Status.COMPLETED:
        return session

    # Update Session status
    session.status = TelehealthSession.Status.COMPLETED
    session.ended_at = timezone.now()
    
    if session.started_at:
        delta = session.ended_at - session.started_at
        session.duration_minutes = max(1, int(delta.total_seconds() / 60))
    else:
        session.duration_minutes = 0
    session.save(update_fields=['status', 'ended_at', 'duration_minutes'])

    # Write Event
    TelehealthEvent.objects.create(
        session=session,
        actor=user,
        event_type=TelehealthEvent.EventType.ENDED,
        metadata={
            'ended_at': session.ended_at.isoformat(),
            'duration_minutes': session.duration_minutes
        }
    )

    channel_layer = get_channel_layer()
    if channel_layer:
        async_to_sync(channel_layer.group_send)(
            f"telehealth_{session.id}",
            {
                "type": "session_ended",
                "session_id": str(session.id),
                "ended_at": session.ended_at.isoformat()
            }
        )

    # Disconnect all participants
    TelehealthParticipant.objects.filter(session=session).update(
        connection_status=TelehealthParticipant.ConnectionStatus.DISCONNECTED,
        left_at=timezone.now()
    )

    # Sync Appointment Status
    appointment = session.appointment
    if appointment.status != Appointment.Status.COMPLETED:
        appointment.status = Appointment.Status.COMPLETED
        appointment.completed_at = session.ended_at
        appointment.save(update_fields=['status', 'completed_at'])

    # Create ConsultationEncounter (guard against duplicate rows from prior calls)
    from naderk.medical_records.models import ConsultationEncounter
    existing = ConsultationEncounter.objects.filter(telehealth_session=session).first()
    if not existing:
        ConsultationEncounter.objects.create(
            telehealth_session=session,
            patient=appointment.patient,
            doctor=appointment.doctor,
            appointment=appointment,
            notes=session.session_notes or '',
        )

    # Notify patient
    create_notification(
        user=appointment.patient,
        title="Consultation Completed",
        message=f"Your telehealth consultation with Dr. {appointment.doctor.last_name} has completed. Thank you for choosing Naderk.",
        conversation=session.conversation
    )

    return session
