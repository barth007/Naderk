import os
from celery import Celery

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')

app = Celery('config')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
# - namespace='CELERY' means all celery-related configuration keys
#   should have a `CELERY_` prefix.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

from celery.schedules import crontab

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

app.conf.beat_schedule = {
    'mark-missed-appointments-every-30-minutes': {
        'task': 'naderk.appointments.tasks.mark_missed_appointments',
        'schedule': crontab(minute='*/30'),  # Run every 30 minutes
    },
    'check-missed-telehealth-sessions-every-30-minutes': {
        'task': 'naderk.telehealth.tasks.check_missed_sessions',
        'schedule': crontab(minute='*/30'),
    },
    'send-telehealth-reminders-every-5-minutes': {
        'task': 'naderk.telehealth.tasks.send_session_reminders',
        'schedule': crontab(minute='*/5'),
    },
}

