from rest_framework.views import APIView
from rest_framework import serializers
from django.contrib.auth import get_user_model
from rest_framework.permissions import IsAuthenticated

from naderk.common.responses.builders import build_success_response
from naderk.common.exceptions.auth import ValidationFailedException, AuthenticationRequiredException
from . import services

User = get_user_model()


class RegistrationSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=8)

class RegisterAPI(APIView):
    """
    POST /auth/register/
    """
    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = services.register_patient(**serializer.validated_data)
        
        return build_success_response(
            message="Registration successful. OTP sent to email.",
            data={"email": user.email},
            status_code=201
        )

class VerifyOTPAPI(APIView):
    """
    POST /auth/verify-otp/
    """
    def post(self, request):
        email = request.data.get('email')
        code = request.data.get('code')
        
        data = services.verify_otp(email=email, code=code)
        
        return build_success_response(
            message="OTP verified successfully.",
            data=data,
            status_code=200
        )

class LoginAPI(APIView):
    """
    POST /auth/login/
    """
    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        
        if not email or not password:
            from naderk.common.exceptions.auth import ValidationFailedException
            raise ValidationFailedException(errors={"non_field_errors": ["Email and password are required."]})
            
        data = services.authenticate_user(email=email, password=password, request=request)
        
        return build_success_response(
            message="Login successful.",
            data=data,
            status_code=200
        )

class ResendOTPAPI(APIView):
    """
    POST /auth/resend-otp/
    """
    def post(self, request):
        email = request.data.get('email')
        try:
            user = User.objects.get(email=email)
            services.generate_and_send_otp(user=user)
        except User.DoesNotExist:
            # Silently succeed to prevent email enumeration
            pass
            
        return build_success_response(
            message="If the email exists, a new OTP has been sent.",
            status_code=200
        )


class MeAPI(APIView):
    """
    GET /api/v1/auth/me/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        
        permission_map = {
            'PATIENT': [],
            'DOCTOR': [
                'appointments.view', 'patients.view', 'prescriptions.create', 
                'telehealth.join', 'access_patient_records', 'access_prescriptions', 
                'access_clinical_notes'
            ],
            'OPTICIAN': [
                'prescriptions.view', 'marketplace.manage', 'access_prescription_reviews', 
                'access_marketplace_fulfillment'
            ],
            'MEDICAL_AGENT': [
                'appointments.view', 'messages.manage', 'access_patient_messaging_queue', 
                'access_appointment_coordination'
            ],
            'ADMIN': [
                'users.manage', 'reports.view', 'access_global_reporting', 
                'access_user_management', 'access_system_configuration'
            ],
            'SUPER_ADMIN': [
                'users.manage', 'reports.view', 'system.manage', 'access_global_reporting', 
                'access_user_management', 'access_system_configuration', 'all_permissions'
            ],
        }
        
        permissions = permission_map.get(user.role, [])
        
        data = {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "full_name": f"{user.first_name} {user.last_name}".strip() or user.email,
            "email": user.email,
            "role": user.role,
            "permissions": permissions,
            "profile_picture": None,
            "cover_photo": None,
            "specialization": None,
            "phone_number": user.phone_number,
            "dob": user.date_of_birth.isoformat() if user.date_of_birth else None,
            "gender": user.gender,
            "profile_completed": user.profile_completion_status == 'COMPLETED',
            "profile_completion_status": user.profile_completion_status,
        }
        
        if user.role == 'PATIENT':
            try:
                profile = user.patient_profile
                data["patient_id"] = profile.patient_id
                # Fallback to profile values if user-level is empty
                if not data["phone_number"]:
                    data["phone_number"] = profile.phone_number
                if not data["dob"]:
                    data["dob"] = profile.dob.isoformat() if profile.dob else None
                if not data["gender"]:
                    data["gender"] = profile.gender
            except Exception:
                pass
        else:
            try:
                staff_profile = user.staff_profile
                data["profile_picture"] = staff_profile.profile_picture
                data["cover_photo"] = staff_profile.cover_photo
            except Exception:
                pass
                
            if user.role == 'DOCTOR':
                try:
                    doc_profile = user.doctor_profile
                    data["specialization"] = doc_profile.get_specialization_display()
                    if not data["profile_picture"]:
                        data["profile_picture"] = doc_profile.profile_picture or doc_profile.avatar
                    if not data["cover_photo"]:
                        data["cover_photo"] = doc_profile.cover_photo
                except Exception:
                    pass
                    
        return build_success_response(
            message="User metadata retrieved successfully.",
            data=data,
            status_code=200
        )


class ChangePasswordAPI(APIView):
    """
    POST /auth/change-password/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')

        if not all([current_password, new_password, confirm_password]):
            raise ValidationFailedException(errors={"non_field_errors": ["All fields are required."]})

        if new_password != confirm_password:
            raise ValidationFailedException(errors={"confirm_password": ["Passwords do not match."]})

        if len(new_password) < 8:
            raise ValidationFailedException(errors={"new_password": ["Password must be at least 8 characters."]})

        user = request.user
        if not user.check_password(current_password):
            raise AuthenticationRequiredException(detail="Current password is incorrect.")

        user.set_password(new_password)
        user.save()

        return build_success_response(
            message="Password changed successfully.",
            data={},
            status_code=200,
        )
