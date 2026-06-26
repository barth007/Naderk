import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from naderk.authentication.services import authenticate_user
from django.http import HttpRequest

request = HttpRequest()
request.META = {'REMOTE_ADDR': '127.0.0.1', 'HTTP_USER_AGENT': 'curl'}

try:
    authenticate_user(email='test@example.com', password='password123', request=request)
except Exception as e:
    import traceback
    traceback.print_exc()
