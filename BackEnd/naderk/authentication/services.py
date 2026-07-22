from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password, check_password
from django.utils import timezone
from django.db import transaction
from rest_framework_simplejwt.tokens import RefreshToken
import random
import datetime
import secrets

from naderk.common.exceptions.auth import InvalidOTPException, AuthenticationRequiredException, ValidationFailedException
from naderk.common.email.services import email_service
from naderk.common.email.exceptions import EmailError
from .models import OTPVerification, LoginAttempt, PasswordResetToken

User = get_user_model()

def _generate_otp_code() -> str:
    return str(random.randint(100000, 999999))

def register_patient(*, email: str, password: str, full_name: str) -> User:
    """
    Registers a new user and forces the PATIENT role.
    Wrapped in transaction.atomic() so a failed email send rolls back
    both the user row and the OTP record, keeping the email address free.
    """
    if User.objects.filter(email=email).exists():
        raise ValidationFailedException(errors={"email": ["A user with this email already exists."]})

    names = full_name.split(' ', 1)
    first_name = names[0]
    last_name = names[1] if len(names) > 1 else ''

    with transaction.atomic():
        user = User.objects.create_user(
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=User.Role.PATIENT,
            is_verified=False,
            otp_verified=False
        )
        generate_and_send_otp(user=user)

    return user


def generate_and_send_otp(*, user: User) -> None:
    """
    Invalidates all previous unused OTPs for the user, creates a new
    hashed OTP record, then sends the plain code by email.
    """
    # Delete all previous unused OTPs so only the latest is ever valid.
    OTPVerification.objects.filter(user=user, is_used=False).delete()

    code = _generate_otp_code()
    expires_at = timezone.now() + datetime.timedelta(minutes=5)

    OTPVerification.objects.create(
        user=user,
        otp_code=make_password(code),   # stored as a hash, never plain text
        expires_at=expires_at,
    )

    # OTP delivery must be confirmed before returning — if email fails the user
    # is stuck on the verification page with no code to enter. Bypass Celery
    # and send synchronously so that failure rolls back the transaction.
    try:
        from django.template.loader import render_to_string
        from naderk.common.email._provider_registry import get_provider
        from naderk.common.email.providers.base import EmailMessage
        from django.conf import settings

        brand = getattr(settings, 'BRAND_NAME', 'Naderkela')
        subject = f"Your {brand} Verification Code"
        html = render_to_string('email/authentication/otp.html', {
            'brand_name': brand,
            'brand_logo_url': getattr(settings, 'BRAND_LOGO_URL', ''),
            'code': code,
            'expires_minutes': 5,
        })

        provider = get_provider()
        provider.send(EmailMessage(
            to=[user.email],
            subject=subject,
            html_body=html,
            text_body=f"Your {brand} verification code is: {code}. It expires in 5 minutes.",
            tags=['otp'],
        ))
    except EmailError as exc:
        raise ValidationFailedException(
            errors={"email": ["We could not send a verification email. Please try again shortly."]}
        ) from exc


def verify_otp(*, email: str, code: str) -> dict:
    """
    Finds the latest unused, non-expired OTP for the user and verifies
    the submitted code against the stored hash.
    """
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        raise InvalidOTPException(detail="Invalid email or OTP.")

    otp_record = OTPVerification.objects.filter(
        user=user,
        is_used=False,
        expires_at__gt=timezone.now()
    ).order_by('-created_at').first()

    if not otp_record or not check_password(code, otp_record.otp_code):
        raise InvalidOTPException(detail="Invalid or expired OTP.")

    otp_record.is_used = True
    otp_record.save(update_fields=['is_used'])

    user.is_verified = True
    user.otp_verified = True
    user.save(update_fields=['is_verified', 'otp_verified'])

    return _get_tokens_for_user(user)


def authenticate_user(*, email: str, password: str, request=None) -> dict:
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


def request_password_reset(*, email: str) -> None:
    """
    Generates a secure reset token and emails a reset link.
    Always returns success to prevent email enumeration.
    """
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return

    # Invalidate any previous unused tokens
    PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)

    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + datetime.timedelta(minutes=30)
    PasswordResetToken.objects.create(user=user, token=token, expires_at=expires_at)

    from django.conf import settings
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    reset_url = f"{frontend_url}/reset-password?token={token}"

    try:
        email_service.send_password_reset(user=user, reset_url=reset_url, expires_minutes=30)
    except EmailError:
        pass


def reset_password(*, token: str, new_password: str) -> None:
    """
    Validates the reset token and sets the new password.
    """
    try:
        record = PasswordResetToken.objects.select_related('user').get(token=token)
    except PasswordResetToken.DoesNotExist:
        raise ValidationFailedException(errors={"token": ["Invalid or expired reset link."]})

    if not record.is_valid():
        raise ValidationFailedException(errors={"token": ["This reset link has expired or already been used."]})

    if len(new_password) < 8:
        raise ValidationFailedException(errors={"new_password": ["Password must be at least 8 characters."]})

    with transaction.atomic():
        record.is_used = True
        record.save(update_fields=['is_used'])
        record.user.set_password(new_password)
        record.user.save(update_fields=['password'])
