from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from .models import PatientProfile

from .models import PatientProfile, StaffProfile, DoctorProfile

User = get_user_model()

@receiver(post_save, sender=User)
def create_user_profile(sender, instance, created, **kwargs):
    if created:
        if instance.role == User.Role.PATIENT:
            PatientProfile.objects.create(user=instance)
        elif instance.role == User.Role.DOCTOR:
            # Create both staff and doctor profiles
            StaffProfile.objects.get_or_create(
                user=instance,
                defaults={
                    'department': "Ophthalmology",
                    'employee_id': f"EMP-DOC-{instance.id.hex[:6].upper()}"
                }
            )
            DoctorProfile.objects.get_or_create(
                user=instance,
                defaults={
                    'specialization': DoctorProfile.Specialization.OPHTHALMOLOGIST
                }
            )
        elif instance.role in [User.Role.OPTICIAN, User.Role.MEDICAL_AGENT, User.Role.ADMIN, User.Role.SUPER_ADMIN, User.Role.AGENT]:
            dept_map = {
                User.Role.OPTICIAN: "Optical",
                User.Role.MEDICAL_AGENT: "Medical Agent Team",
                User.Role.AGENT: "Medical Agent Team",
                User.Role.ADMIN: "Administration",
                User.Role.SUPER_ADMIN: "Administration",
            }
            dept = dept_map.get(instance.role, "Staff")
            prefix = f"EMP-{instance.role[:4].upper()}"
            StaffProfile.objects.get_or_create(
                user=instance,
                defaults={
                    'department': dept,
                    'employee_id': f"{prefix}-{instance.id.hex[:6].upper()}"
                }
            )


from django.db.models.signals import pre_save
import random

@receiver(pre_save, sender=PatientProfile)
def generate_patient_id(sender, instance, **kwargs):
    if not instance.patient_id:
        while True:
            new_id = f"NE-{random.randint(1000, 9999)}"
            if not PatientProfile.objects.filter(patient_id=new_id).exists():
                instance.patient_id = new_id
                break
