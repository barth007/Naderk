import datetime
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from naderk.appointments.models import Appointment
from naderk.telehealth.models import TelehealthSession, TelehealthEvent
from naderk.messaging.models import Conversation, MessagingCategory
from naderk.messaging.services import create_conversation
from naderk.notifications.services import create_notification

@receiver(post_save, sender=Appointment)
def handle_appointment_telehealth_sync(sender, instance, created, **kwargs):
    if instance.appointment_type == Appointment.AppointmentType.TELEHEALTH:
        if instance.status == Appointment.Status.CONFIRMED:
            # Generate start/end datetimes
            start_dt = timezone.make_aware(datetime.datetime.combine(instance.appointment_date, instance.appointment_time))
            end_dt = start_dt + datetime.timedelta(minutes=instance.service.duration_minutes)

            # Create or get the telehealth session
            session, session_created = TelehealthSession.objects.get_or_create(
                appointment=instance,
                defaults={
                    'room_name': f"telehealth-appointment-{instance.id}",
                    'status': TelehealthSession.Status.SCHEDULED,
                    'scheduled_start': start_dt,
                    'scheduled_end': end_dt,
                }
            )

            # Update meeting_link to point to the local frontend path
            local_link = f"/dashboard/telehealth/{session.id}"
            if instance.meeting_link != local_link:
                Appointment.objects.filter(id=instance.id).update(meeting_link=local_link)


            if session_created:
                # Find or create a messaging conversation
                conv = Conversation.objects.filter(related_appointment=instance).first()
                if not conv:
                    try:
                        conv = create_conversation(
                            patient=instance.patient,
                            category=MessagingCategory.TELEHEALTH,
                            subject=f"Telehealth Session: {instance.service.name}",
                            initial_message=f"This thread is created for your upcoming telehealth consultation with Dr. {instance.doctor.last_name} on {instance.appointment_date} at {instance.appointment_time}."
                        )
                        # Link conversation to appointment
                        conv.related_appointment = instance
                        conv.save(update_fields=['related_appointment'])
                    except Exception as e:
                        print(f"Error creating conversation for telehealth: {e}")

                if conv:
                    session.conversation = conv
                    session.save(update_fields=['conversation'])

                # Log event
                TelehealthEvent.objects.create(
                    session=session,
                    actor=None,
                    event_type=TelehealthEvent.EventType.CREATED,
                    metadata={'msg': 'Session automatically scheduled via confirmed appointment'}
                )

                # Send notification to patient
                create_notification(
                    user=instance.patient,
                    title="Telehealth Session Scheduled",
                    message=f"Your remote consultation for {instance.service.name} has been scheduled for {instance.appointment_date} at {instance.appointment_time}.",
                    conversation=conv
                )

        elif instance.status == Appointment.Status.CANCELLED:
            try:
                session = instance.telehealth_session
                if session.status != TelehealthSession.Status.CANCELLED:
                    session.status = TelehealthSession.Status.CANCELLED
                    session.save(update_fields=['status'])

                    # Log Event
                    TelehealthEvent.objects.create(
                        session=session,
                        actor=None,
                        event_type=TelehealthEvent.EventType.CANCELLED,
                        metadata={'reason': 'Associated appointment was cancelled'}
                    )
            except TelehealthSession.DoesNotExist:
                pass

        elif instance.status == Appointment.Status.NO_SHOW:
            try:
                session = instance.telehealth_session
                if session.status != TelehealthSession.Status.MISSED:
                    session.status = TelehealthSession.Status.MISSED
                    session.save(update_fields=['status'])

                    # Log Event
                    TelehealthEvent.objects.create(
                        session=session,
                        actor=None,
                        event_type=TelehealthEvent.EventType.MISSED,
                        metadata={'reason': 'Associated appointment was marked as missed'}
                    )
            except TelehealthSession.DoesNotExist:
                pass
