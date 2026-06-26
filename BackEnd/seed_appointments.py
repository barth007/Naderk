import os
import django
import datetime
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()

from naderk.core.models import User
from naderk.users.models import DoctorProfile
from naderk.appointments.models import MedicalService, DoctorAvailability

def seed():
    print("Seeding Medical Services...")
    services = [
        {
            "name": "Comprehensive Eye Exam",
            "slug": "comprehensive-eye-exam",
            "description": "A full evaluation of your vision and eye health.",
            "required_specialization": DoctorProfile.Specialization.OPTOMETRIST,
            "duration_minutes": 30,
            "fee": Decimal("3000.00"),
            "billing_type": MedicalService.BillingType.MONTHLY,
            "sessions_included": None,
        },
        {
            "name": "Cataract Consultation",
            "slug": "cataract-consultation",
            "description": "Evaluation for cataract surgery and treatment options.",
            "required_specialization": DoctorProfile.Specialization.OPHTHALMOLOGIST,
            "duration_minutes": 45,
            "fee": Decimal("10000.00"),
            "billing_type": MedicalService.BillingType.SESSION_PACK,
            "sessions_included": 2,
        },
        {
            "name": "Glaucoma Screening",
            "slug": "glaucoma-screening",
            "description": "Specialized testing to detect early signs of glaucoma.",
            "required_specialization": DoctorProfile.Specialization.OPHTHALMOLOGIST,
            "duration_minutes": 45,
            "fee": Decimal("10000.00"),
            "billing_type": MedicalService.BillingType.SESSION_PACK,
            "sessions_included": 3,
        },
        {
            "name": "General Checkup",
            "slug": "general-checkup",
            "description": "Routine health checkup.",
            "required_specialization": DoctorProfile.Specialization.GENERAL_PRACTITIONER,
            "duration_minutes": 30,
            "fee": Decimal("5000.00"),
            "billing_type": MedicalService.BillingType.MONTHLY,
            "sessions_included": None,
        }
    ]

    for s_data in services:
        obj, created = MedicalService.objects.get_or_create(
            slug=s_data['slug'],
            defaults=s_data
        )
        if not created:
            # Update billing fields on existing services
            for field in ('fee', 'billing_type', 'sessions_included'):
                setattr(obj, field, s_data[field])
            obj.save(update_fields=['fee', 'billing_type', 'sessions_included'])

    print("Seeding Doctors...")
    # Doctor 1
    d1_user, _ = User.objects.get_or_create(
        email="optometrist@naderk.com",
        defaults={
            "first_name": "Sarah",
            "last_name": "Bwala",
            "role": User.Role.DOCTOR,
            "is_verified": True,
            "otp_verified": True
        }
    )
    if not d1_user.check_password('doctor123'):
        d1_user.set_password('doctor123')
        d1_user.save()
        
    DoctorProfile.objects.get_or_create(
        user=d1_user,
        defaults={
            "specialization": DoctorProfile.Specialization.OPTOMETRIST,
            "years_experience": 12,
            "bio": "Experienced Optometrist specializing in comprehensive eye care.",
            "avatar": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&auto=format&fit=crop&q=60"
        }
    )
    
    # Doctor 2
    d2_user, _ = User.objects.get_or_create(
        email="ophthalmologist@naderk.com",
        defaults={
            "first_name": "David",
            "last_name": "Okon",
            "role": User.Role.DOCTOR,
            "is_verified": True,
            "otp_verified": True
        }
    )
    if not d2_user.check_password('doctor123'):
        d2_user.set_password('doctor123')
        d2_user.save()
        
    DoctorProfile.objects.get_or_create(
        user=d2_user,
        defaults={
            "specialization": DoctorProfile.Specialization.OPHTHALMOLOGIST,
            "years_experience": 15,
            "bio": "Expert in cataract and glaucoma surgeries.",
            "avatar": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=800&auto=format&fit=crop&q=60"
        }
    )

    print("Seeding Availability...")
    # Seed 9-5 availability for every weekday for both doctors
    for doctor in [d1_user, d2_user]:
        for day in range(7): # 0 to 6
            DoctorAvailability.objects.get_or_create(
                doctor=doctor,
                weekday=day,
                start_time=datetime.time(9, 0),
                defaults={
                    "end_time": datetime.time(17, 0),
                    "slot_duration": 30
                }
            )

    print("Seeding completed!")

if __name__ == "__main__":
    seed()
