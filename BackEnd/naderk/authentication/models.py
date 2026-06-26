from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class OTPVerification(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='otp_verifications')
    otp_code = models.CharField(max_length=128) # Hashed OTP code
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    retry_attempts = models.IntegerField(default=0)

    def is_valid(self):
        return not self.is_used and self.expires_at > timezone.now()

class LoginAttempt(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='login_attempts')
    email = models.EmailField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    is_successful = models.BooleanField(default=False)
    attempted_at = models.DateTimeField(auto_now_add=True)
