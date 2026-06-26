import os
import django
import sys

# Setup django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from naderk.appointments.tasks import mark_missed_appointments

print("Running mark_missed_appointments manually...")
result = mark_missed_appointments()
print(f"Result: {result}")
