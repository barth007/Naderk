"""
Recompute scheduled_start/scheduled_end for upcoming telehealth sessions.

These were computed with timezone.make_aware() while TIME_ZONE was 'UTC', so a
naive local (WAT) appointment time was stored an hour late. Now that TIME_ZONE
is the platform's local zone, recompute them from the appointment's date/time so
existing bookings line up with the appointments page and the join window.
"""
import datetime
from django.db import migrations


def fix_scheduled_times(apps, schema_editor):
    from django.utils import timezone
    TelehealthSession = apps.get_model('telehealth', 'TelehealthSession')

    now = timezone.now()
    qs = (
        TelehealthSession.objects
        .filter(scheduled_start__gte=now)
        .exclude(status__in=['COMPLETED', 'CANCELLED', 'MISSED'])
        .select_related('appointment')
    )
    for session in qs.iterator():
        appt = getattr(session, 'appointment', None)
        if not appt or not appt.appointment_date or not appt.appointment_time:
            continue
        new_start = timezone.make_aware(
            datetime.datetime.combine(appt.appointment_date, appt.appointment_time)
        )
        duration = None
        if session.scheduled_start and session.scheduled_end:
            duration = session.scheduled_end - session.scheduled_start
        if not duration or duration.total_seconds() <= 0:
            duration = datetime.timedelta(minutes=30)
        session.scheduled_start = new_start
        session.scheduled_end = new_start + duration
        session.save(update_fields=['scheduled_start', 'scheduled_end'])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('telehealth', '0002_telehealthsession_doctor_telehealthsession_patient_and_more'),
    ]

    operations = [
        migrations.RunPython(fix_scheduled_times, noop),
    ]
