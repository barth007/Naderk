import datetime
from django.utils import timezone
from celery import shared_task
from .models import Appointment

#: How long an unpaid appointment may sit before it is treated as abandoned.
#: The booking flow creates the row *before* payment, so a failed or abandoned
#: checkout leaves one behind; without this it showed on the patient's
#: Appointments page as an ordinary pending booking forever.
ABANDONED_UNPAID_MINUTES = 30


@shared_task
def mark_missed_appointments():
    """
    Mark appointments as missed (NO_SHOW) once 30 minutes have passed since
    their start time and they were never seen through to completion.

    Covers PENDING as well as CONFIRMED: a paid appointment that is never
    confirmed by staff still sits at PENDING, and previously stayed "Pending"
    forever after its date passed — both on the patient's Appointments page and
    in admin billing.
    """
    now = timezone.now()
    cutoff_time = now - datetime.timedelta(minutes=30)

    candidates = Appointment.objects.filter(
        status__in=[
            Appointment.Status.CONFIRMED,
            Appointment.Status.PENDING,
            Appointment.Status.CHECKED_IN,
        ],
        appointment_date__lte=cutoff_time.date(),
    )

    missed_count = 0
    for appt in candidates:
        # An unpaid PENDING booking is an abandoned checkout, not a missed
        # visit — cancel_abandoned_unpaid_appointments handles those.
        if appt.status == Appointment.Status.PENDING and appt.payment_status != Appointment.PaymentStatus.PAID:
            continue

        # appointment_time is naive; interpret it in the active timezone.
        appt_datetime = timezone.make_aware(datetime.datetime.combine(appt.appointment_date, appt.appointment_time))

        if appt_datetime < cutoff_time:
            appt.status = Appointment.Status.NO_SHOW
            appt.missed_at = now
            appt.save(update_fields=['status', 'missed_at'])
            missed_count += 1

    return f"Marked {missed_count} appointments as missed."


@shared_task
def cancel_abandoned_unpaid_appointments():
    """
    Cancel appointments whose checkout was never completed.

    `POST /appointments/create/` persists the appointment before Paystack is
    initialized, so any failure between the two — a failed initialization, a
    closed popup, a dropped connection — leaves an unpaid PENDING row. The
    frontend deletes it on the paths it can see, but it cannot clean up after a
    crashed tab, so this is the backstop.
    """
    cutoff = timezone.now() - datetime.timedelta(minutes=ABANDONED_UNPAID_MINUTES)

    stale = Appointment.objects.unpaid_checkouts().filter(created_at__lt=cutoff)

    cancelled = stale.update(
        status=Appointment.Status.CANCELLED,
        cancelled_at=timezone.now(),
        cancellation_reason='Payment was not completed.',
    )
    return f"Cancelled {cancelled} abandoned unpaid appointments."
