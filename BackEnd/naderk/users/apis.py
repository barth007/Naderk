from rest_framework.views import APIView
from rest_framework import serializers
from rest_framework.permissions import IsAuthenticated
from django.contrib.auth import get_user_model
from naderk.common.storage.service import storage_service

from naderk.common.responses.builders import build_success_response
from naderk.common.exceptions.auth import ValidationFailedException
from .models import PatientProfile, DoctorProfile, StaffProfile

User = get_user_model()


def _seed_default_availability(doctor_user) -> None:
    """Create Mon–Fri 8am–5pm availability for a doctor who has none yet."""
    import datetime
    from naderk.appointments.models import DoctorAvailability
    if DoctorAvailability.objects.filter(doctor=doctor_user).exists():
        return
    for weekday in range(5):  # 0=Mon … 4=Fri
        DoctorAvailability.objects.get_or_create(
            doctor=doctor_user,
            weekday=weekday,
            start_time=datetime.time(8, 0),
            defaults=dict(end_time=datetime.time(17, 0), slot_duration=30, is_active=True),
        )


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        exclude = ('id', 'user', 'updated_at')
        read_only_fields = ('patient_id', 'created_at')

class DoctorProfileSerializer(serializers.ModelSerializer):
    first_name = serializers.CharField(source='user.first_name', required=False)
    last_name = serializers.CharField(source='user.last_name', required=False)
    email = serializers.EmailField(source='user.email', read_only=True)
    phone_number = serializers.CharField(source='user.phone_number', required=False, allow_null=True)
    date_of_birth = serializers.DateField(source='user.date_of_birth', required=False, allow_null=True)
    gender = serializers.CharField(source='user.gender', required=False, allow_null=True)
    
    office_address = serializers.CharField(source='user.staff_profile.office_address', required=False, allow_null=True)
    employment_date = serializers.DateField(source='user.staff_profile.employment_date', required=False, allow_null=True)

    class Meta:
        model = DoctorProfile
        exclude = ('id', 'user', 'updated_at')
        read_only_fields = ('created_at', 'consultation_fee', 'consultation_duration')

    def update(self, instance, validated_data):
        user_data = validated_data.pop('user', {})
        staff_data = user_data.pop('staff_profile', {})
        
        # Update DoctorProfile fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        
        # Update User fields
        user = instance.user
        for attr, value in user_data.items():
            setattr(user, attr, value)
        user.save()
        
        # Update StaffProfile fields
        if hasattr(user, 'staff_profile'):
            staff = user.staff_profile
            for attr, value in staff_data.items():
                setattr(staff, attr, value)
            # Sync photo fields
            staff.profile_picture = instance.profile_picture or instance.avatar
            staff.cover_photo = instance.cover_photo
            staff.save()
            
        return instance

class PatientProfileAPI(APIView):
    """
    GET /users/profile/
    PUT /users/profile/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role == 'DOCTOR':
            profile, created = DoctorProfile.objects.get_or_create(
                user=user,
                defaults={'specialization': DoctorProfile.Specialization.OPHTHALMOLOGIST}
            )
            serializer = DoctorProfileSerializer(profile)
            return build_success_response(
                message="Doctor profile retrieved successfully.",
                data=serializer.data,
                status_code=200
            )
        else:
            profile, created = PatientProfile.objects.get_or_create(user=user)
            serializer = ProfileSerializer(profile)
            return build_success_response(
                message="Profile retrieved successfully.",
                data=serializer.data,
                status_code=200
            )

    def put(self, request):
        user = request.user
        if user.role == 'DOCTOR':
            profile, created = DoctorProfile.objects.get_or_create(
                user=user,
                defaults={'specialization': DoctorProfile.Specialization.OPHTHALMOLOGIST}
            )
            
            # Ensure staff profile exists
            StaffProfile.objects.get_or_create(user=user)
            
            serializer = DoctorProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            user.refresh_from_db()
            profile.refresh_from_db()
            
            # Check for onboarding completion based on critical fields
            req_fields = [
                user.first_name, user.last_name, user.phone_number, user.date_of_birth, user.gender,
                profile.specialization, profile.license_number, profile.years_of_experience,
                profile.bio, profile.max_daily_patients
            ]
            
            if all(f is not None and str(f).strip() != "" for f in req_fields):
                user.profile_completion_status = 'COMPLETED'
                user.save()
                _seed_default_availability(user)
                
            # Serialize fresh data after refresh
            fresh_serializer = DoctorProfileSerializer(profile)
            return build_success_response(
                message="Doctor profile updated successfully.",
                data=fresh_serializer.data,
                status_code=200
            )
        else:
            profile, created = PatientProfile.objects.get_or_create(user=user)
            serializer = ProfileSerializer(profile, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            
            # Sync user model with patient profile values
            user.phone_number = profile.phone_number
            user.date_of_birth = profile.dob
            user.gender = profile.gender
            user.save()
            
            if user.profile_completion_status != 'COMPLETED':
                if profile.dob and profile.gender:
                    user.profile_completion_status = 'COMPLETED'
                    user.save()
                    
            return build_success_response(
                message="Profile updated successfully.",
                data=serializer.data,
                status_code=200
            )


class UploadImageAPI(APIView):
    """
    POST /users/upload-image/
    Accepts a multipart file, uploads it to Cloudinary, returns the secure URL.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            raise ValidationFailedException(errors={"file": ["No file provided."]})

        result = storage_service.upload_file(file, bucket_type='public', prefix='avatars', uploaded_by=request.user)
        return build_success_response(
            message="Image uploaded successfully.",
            data={"url": result.url},
            status_code=200,
        )


class DoctorListAPI(APIView):
    """
    GET /users/doctors/
    Returns a list of all doctors.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctors = User.objects.filter(role='DOCTOR')
        data = []
        for doc in doctors:
            spec = None
            if hasattr(doc, 'doctor_profile') and doc.doctor_profile:
                spec = doc.doctor_profile.specialization
            data.append({
                "id": str(doc.id),
                "first_name": doc.first_name,
                "last_name": doc.last_name,
                "full_name": f"{doc.first_name} {doc.last_name}".strip() or doc.email,
                "email": doc.email,
                "specialization": spec,
            })
        return build_success_response("Doctors retrieved successfully.", {"results": data})
