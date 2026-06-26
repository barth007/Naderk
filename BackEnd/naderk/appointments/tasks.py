import datetime
from django.utils import timezone
from celery import shared_task
from .models import Appointment

@shared_task
def mark_missed_appointments():
    """
    Automatically mark appointments as missed (NO_SHOW) if 
    30 minutes have passed since their start time and they
    are still in CONFIRMED state.
    """
    now = timezone.now()
    cutoff_time = now - datetime.timedelta(minutes=30)
    
    candidates = Appointment.objects.filter(
        status=Appointment.Status.CONFIRMED,
        appointment_date__lte=cutoff_time.date()
    )
    
    missed_count = 0
    for appt in candidates:
        # Since appointment_time is timezone naive, we make it aware using the current timezone
        appt_datetime = timezone.make_aware(datetime.datetime.combine(appt.appointment_date, appt.appointment_time))
        
        if appt_datetime < cutoff_time:
            appt.status = Appointment.Status.NO_SHOW
            appt.missed_at = now
            appt.save(update_fields=['status', 'missed_at'])
            missed_count += 1
            
    return f"Marked {missed_count} appointments as missed."
