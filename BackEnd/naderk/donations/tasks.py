from celery import shared_task

from .services import send_due_reminders


@shared_task
def send_donation_reminders():
    """Daily: the yearly "time to give again" email for annual donors."""
    return f"Sent {send_due_reminders()} donation reminders."
