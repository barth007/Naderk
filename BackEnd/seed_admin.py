import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

EMAIL = 'admin@naderk.com'
PASSWORD = 'Admin@1234'

user, created = User.objects.get_or_create(
    email=EMAIL,
    defaults={
        'first_name': 'Clinic',
        'last_name': 'Admin',
        'role': 'ADMIN',
        'is_verified': True,
        'otp_verified': True,
        'profile_completion_status': 'COMPLETED',
        'is_active': True,
    }
)

if created:
    user.set_password(PASSWORD)
    user.save()
    print(f"[OK] Admin created: {EMAIL} / {PASSWORD}")
else:
    print(f"[INFO] Admin already exists: {EMAIL}")
    print(f"       To reset password, run: user.set_password('{PASSWORD}'); user.save()")
