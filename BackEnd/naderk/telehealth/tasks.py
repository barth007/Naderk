import datetime
from django.utils import timezone
from celery import shared_task
from naderk.telehealth.models import TelehealthSession, TelehealthParticipant, TelehealthEvent
from naderk.appointments.models import Appointment
from naderk.notifications.services import create_notification

@shared_task
def check_missed_sessions():
    """
    Sweeps scheduled, ready, or waiting telehealth sessions that have passed
    their start time by max_wait_minutes (15 mins) and marks them as missed
    with granular reasons (patient no show, doctor no show, or both).
    """
    now = timezone.now()
    max_wait_minutes = 15
    cutoff_time = now - datetime.timedelta(minutes=max_wait_minutes)
    
    # Active candidates that have passed the cutoff time
    sessions = TelehealthSession.objects.filter(
        status__in=[
            TelehealthSession.Status.SCHEDULED,
            TelehealthSession.Status.WAITING_ROOM,
            TelehealthSession.Status.WAITING_FOR_DOCTOR
        ],
        scheduled_start__lte=cutoff_time
    )
    
    updated_count = 0
    for session in sessions:
        appointment = session.appointment
        
        # Check if participants joined
        patient_joined = session.participants.filter(role=TelehealthParticipant.Role.PATIENT).exists()
        doctor_joined = session.participants.filter(role=TelehealthParticipant.Role.DOCTOR).exists()
        
        session.status = TelehealthSession.Status.MISSED
        session.save(update_fields=['status'])
        
        # Mark appointment as missed
        appointment.status = Appointment.Status.NO_SHOW
        appointment.missed_at = now
        appointment.save(update_fields=['status', 'missed_at'])
        
        event_type = TelehealthEvent.EventType.MISSED
        metadata = {'detail': 'Session missed'}
        
        if patient_joined and not doctor_joined:
            metadata['detail'] = 'Patient was waiting, doctor failed to join'
            
            # Notify patient
            create_notification(
                user=appointment.patient,
                title="Consultation Missed",
                message=f"Your telehealth session with Dr. {appointment.doctor.last_name} was missed because the doctor did not connect. Please reschedule.",
                conversation=session.conversation
            )
            
        elif doctor_joined and not patient_joined:
            metadata['detail'] = 'Doctor was waiting, patient failed to join'
            
            # Notify doctor
            create_notification(
                user=appointment.doctor,
                title="Patient Absent",
                message=f"The patient failed to join the telehealth consultation scheduled for {session.scheduled_start}.",
                conversation=session.conversation
            )
            
        else:
            metadata['detail'] = 'Neither participant joined the room'
            
            # Notify both
            create_notification(
                user=appointment.patient,
                title="Telehealth Session Missed",
                message="You missed your scheduled telehealth consultation.",
                conversation=session.conversation
            )
            create_notification(
                user=appointment.doctor,
                title="Telehealth Session Missed",
                message="Scheduled telehealth session was missed by both parties.",
                conversation=session.conversation
            )
            
        # Log event
        TelehealthEvent.objects.create(
            session=session,
            actor=None,
            event_type=event_type,
            metadata=metadata
        )
        updated_count += 1
        
    return f"Processed {updated_count} missed telehealth sessions."

@shared_task
def send_session_reminders():
    """
    Sends notification reminders to patients and doctors for sessions starting in 15 minutes.
    """
    now = timezone.now()
    start_window = now + datetime.timedelta(minutes=10)
    end_window = now + datetime.timedelta(minutes=20)
    
    sessions = TelehealthSession.objects.filter(
        status=TelehealthSession.Status.SCHEDULED,
        scheduled_start__gte=start_window,
        scheduled_start__lte=end_window
    )
    
    reminded_count = 0
    for session in sessions:
        # Check if reminder event was already logged
        already_reminded = TelehealthEvent.objects.filter(
            session=session,
            metadata__reminder_sent=True
        ).exists()
        
        if already_reminded:
            continue
            
        appointment = session.appointment
        
        # Send notification to patient
        create_notification(
            user=appointment.patient,
            title="Telehealth Session in 15 Mins",
            message=f"Reminder: Your telehealth session with Dr. {appointment.doctor.last_name} starts in 15 minutes.",
            conversation=session.conversation
        )
        
        # Send notification to doctor
        create_notification(
            user=appointment.doctor,
            title="Telehealth Session in 15 Mins",
            message=f"Reminder: Your telehealth session with {appointment.patient.first_name} starts in 15 minutes.",
            conversation=session.conversation
        )
        
        # Log event
        TelehealthEvent.objects.create(
            session=session,
            actor=None,
            event_type=TelehealthEvent.EventType.CREATED, # use created or custom choice
            metadata={'reminder_sent': True, 'msg': '15-minute reminder sent'}
        )
        reminded_count += 1
        
    return f"Sent reminders for {reminded_count} sessions."
