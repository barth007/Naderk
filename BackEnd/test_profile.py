import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from django.test import Client, override_settings
from naderk.authentication.models import OTPVerification
import json

@override_settings(ALLOWED_HOSTS=['testserver'])
def run():
    client = Client()
    # 1. Register
    response = client.post('/api/v1/auth/register/', json.dumps({
        'full_name': 'Jane Doe',
        'email': 'jane@example.com',
        'password': 'password123'
    }), content_type='application/json')
    print(f"Register: {response.status_code} {response.content}")
    
    # 2. Get OTP
    otp_record = OTPVerification.objects.filter(user__email='jane@example.com').first()
    if not otp_record:
        print("No OTP found!")
        return
        
    code = otp_record.otp_code
    
    # 3. Verify OTP
    response = client.post('/api/v1/auth/verify-otp/', json.dumps({
        'email': 'jane@example.com',
        'code': code
    }), content_type='application/json')
    print(f"Verify OTP: {response.status_code} {response.content}")
    
    if response.status_code != 200:
        return
        
    data = response.json()['data']
    token = data['access']
    
    # 4. Get Profile
    response = client.get('/api/v1/users/profile/', HTTP_AUTHORIZATION=f'Bearer {token}')
    print(f"Get Profile: {response.status_code} {response.content}")

run()
