from django.contrib.auth import get_user_model
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework_simplejwt.tokens import RefreshToken
import random
import datetime

from naderk.common.exceptions.auth import InvalidOTPException, AuthenticationRequiredException, ValidationFailedException
from .models import OTPVerification, LoginAttempt

User = get_user_model()

def _generate_otp_code() -> str:
    return str(random.randint(100000, 999999))

def register_patient(*, email: str, password: str, full_name: str) -> User:
    """
    Registers a new user and forces the PATIENT role.
    """
    if User.objects.filter(email=email).exists():
        raise ValidationFailedException(errors={"email": ["A user with this email already exists."]})

    # Extract first and last name from full_name if necessary, or just save full_name.
    # AbstractUser has first_name and last_name
    names = full_name.split(' ', 1)
    first_name = names[0]
    last_name = names[1] if len(names) > 1 else ''

    user = User.objects.create_user(
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        role=User.Role.PATIENT,
        is_verified=False,
        otp_verified=False
    )
    
    # Generate and send OTP
    generate_and_send_otp(user=user)
    
    return user

def generate_and_send_otp(*, user: User) -> None:
    """
    Generates a 6 digit OTP and sends it via email.
    """
    code = _generate_otp_code()
    # Expire in 5 minutes
    expires_at = timezone.now() + datetime.timedelta(minutes=5)
    
    OTPVerification.objects.create(
        user=user,
        otp_code=code, # In a real app, hash this code (e.g. make_password)
        expires_at=expires_at
    )
    
    # Send email (Synchronous for now, ideally dispatch to Celery)
    # from naderk.authentication.tasks import send_otp_email_task
    # send_otp_email_task.delay(user.email, code)
    
    send_mail(
        subject="Your NaderkEye Verification Code",
        message=f"Your verification code is: {code}. It expires in 5 minutes.",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )

def verify_otp(*, email: str, code: str) -> dict:
    """
    Verifies the OTP code. If valid, marks user as verified and returns JWT tokens.
    """
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        raise InvalidOTPException(detail="Invalid email or OTP.")
        
    otp_record = OTPVerification.objects.filter(
        user=user,
        otp_code=code,
        is_used=False,
        expires_at__gt=timezone.now()
    ).order_by('-created_at').first()
    
    if not otp_record:
        raise InvalidOTPException(detail="Invalid or expired OTP.")
        
    # Mark as used
    otp_record.is_used = True
    otp_record.save()
    
    # Verify user
    user.is_verified = True
    user.otp_verified = True
    user.save()
    
    return _get_tokens_for_user(user)

def authenticate_user(*, email: str, password: str, request=None) -> dict:
    """
    Authenticates user and returns JWT tokens.
    """
    ip_address = request.META.get('REMOTE_ADDR') if request else None
    user_agent = request.META.get('HTTP_USER_AGENT') if request else None
    
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        LoginAttempt.objects.create(email=email or "", is_successful=False, ip_address=ip_address, user_agent=user_agent)
        raise AuthenticationRequiredException(detail="Invalid credentials.")

    if not user.check_password(password):
        LoginAttempt.objects.create(user=user, email=email, is_successful=False, ip_address=ip_address, user_agent=user_agent)
        raise AuthenticationRequiredException(detail="Invalid credentials.")
        
    # OTP verification is only required for patients — staff accounts are created internally
    if user.role == 'PATIENT' and not user.otp_verified:
        raise AuthenticationRequiredException(
            detail="Account not verified. Please verify your OTP.",
            code="not_verified"
        )
        
    LoginAttempt.objects.create(user=user, email=email, is_successful=True, ip_address=ip_address, user_agent=user_agent)
    
    return _get_tokens_for_user(user)

def _get_tokens_for_user(user: User) -> dict:
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
        'user': {
            'id': str(user.id),
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'profile_completion_status': user.profile_completion_status,
        }
    }
