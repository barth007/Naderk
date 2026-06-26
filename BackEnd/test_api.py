import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from naderk.users.apis import PatientProfileAPI
from naderk.core.models import User
from naderk.users.models import PatientProfile

user = User.objects.get(email="jane@example.com")
factory = APIRequestFactory()
request = factory.put('/api/v1/users/profile/', data={
    "phone_number": "+2348012345678",
    "dob": "1990-01-01",
    "gender": "Female",
    "state": "Lagos",
    "city": "Ikeja",
    "address": "123 Main St",
    "emergency_contact_name": "John Doe",
    "emergency_contact_relationship": "Brother",
    "emergency_contact_phone": "+2348012345679"
}, format='json')

force_authenticate(request, user=user)

view = PatientProfileAPI.as_view()
response = view(request)
print("Response status:", response.status_code)
print("Response data:", response.data)

p = PatientProfile.objects.get(user=user)
print("DB Data:", p.dob, p.gender, p.user.profile_completion_status)
