import os
import django
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from naderk.core.models import User
from naderk.users.models import DoctorProfile

DOCTORS = [
    {
        'first_name': 'Amara',
        'last_name':  'Okonkwo',
        'email':      'dr.okonkwo@naderkeye.com',
        'password':   'Doctor@1234',
        'specialization': 'OPTOMETRIST',
        'license_number': 'NMC-OPT-00421',
        'years_of_experience': 8,
        'consultation_fee': Decimal('5000.00'),
        'bio': 'Dr. Okonkwo specialises in paediatric optometry and refractive error management. '
               'She completed her residency at LUTH and has over 8 years of clinical experience.',
        'telehealth_enabled': True,
        'is_accepting_patients': True,
        'max_daily_appointments': 20,
        'consultation_duration': 30,
    },
    {
        'first_name': 'Emeka',
        'last_name':  'Adeyemi',
        'email':      'dr.adeyemi@naderkeye.com',
        'password':   'Doctor@1234',
        'specialization': 'OPHTHALMOLOGIST',
        'license_number': 'NMC-OPH-00815',
        'years_of_experience': 14,
        'consultation_fee': Decimal('10000.00'),
        'bio': 'Dr. Adeyemi is a consultant ophthalmologist with expertise in cataract surgery, '
               'glaucoma management, and laser refractive procedures. Fellow of the West African '
               'College of Surgeons.',
        'telehealth_enabled': True,
        'is_accepting_patients': True,
        'max_daily_appointments': 15,
        'consultation_duration': 45,
    },
    {
        'first_name': 'Fatima',
        'last_name':  'Bello',
        'email':      'dr.bello@naderkeye.com',
        'password':   'Doctor@1234',
        'specialization': 'OPTOMETRIST',
        'license_number': 'NMC-OPT-00633',
        'years_of_experience': 5,
        'consultation_fee': Decimal('4000.00'),
        'bio': 'Dr. Bello focuses on contact lens fitting, dry eye management, and low vision '
               'rehabilitation. She holds an MSc in Clinical Optometry from the University of Manchester.',
        'telehealth_enabled': True,
        'is_accepting_patients': True,
        'max_daily_appointments': 18,
        'consultation_duration': 30,
    },
    {
        'first_name': 'Chukwuemeka',
        'last_name':  'Nwosu',
        'email':      'dr.nwosu@naderkeye.com',
        'password':   'Doctor@1234',
        'specialization': 'GENERAL_PRACTITIONER',
        'license_number': 'NMC-GP-01122',
        'years_of_experience': 10,
        'consultation_fee': Decimal('3000.00'),
        'bio': 'Dr. Nwosu provides comprehensive eye health assessments and co-manages patients '
               'with systemic conditions affecting vision such as diabetes and hypertension.',
        'telehealth_enabled': True,
        'is_accepting_patients': True,
        'max_daily_appointments': 22,
        'consultation_duration': 20,
    },
    {
        'first_name': 'Ngozi',
        'last_name':  'Eze',
        'email':      'dr.eze@naderkeye.com',
        'password':   'Doctor@1234',
        'specialization': 'OPHTHALMOLOGIST',
        'license_number': 'NMC-OPH-00977',
        'years_of_experience': 18,
        'consultation_fee': Decimal('12000.00'),
        'bio': 'Prof. Eze is a senior ophthalmologist and vitreoretinal specialist. She leads the '
               'retina clinic at Naderk Eye Center and has authored over 30 peer-reviewed publications.',
        'telehealth_enabled': False,
        'is_accepting_patients': True,
        'max_daily_appointments': 10,
        'consultation_duration': 60,
    },
]


def seed():
    print("\n── Seeding Doctors ──────────────────────────────────────────")
    created = []
    skipped = []

    for d in DOCTORS:
        user, _ = User.objects.get_or_create(
            email=d['email'],
            defaults=dict(
                first_name=d['first_name'],
                last_name=d['last_name'],
                role='DOCTOR',
                is_active=True,
                profile_completion_status='PENDING',  # forces onboarding on first login
            ),
        )
        user.set_password(d['password'])
        user.save(update_fields=['password'])

        DoctorProfile.objects.get_or_create(
            user=user,
            defaults=dict(
                specialization=d['specialization'],
                license_number=d['license_number'],
                years_of_experience=d['years_of_experience'],
                years_experience=d['years_of_experience'],
                consultation_fee=d['consultation_fee'],
                bio=d['bio'],
                telehealth_enabled=d['telehealth_enabled'],
                accepts_telehealth=d['telehealth_enabled'],
                is_accepting_patients=d['is_accepting_patients'],
                max_daily_appointments=d['max_daily_appointments'],
                max_daily_patients=d['max_daily_appointments'],
                consultation_duration=d['consultation_duration'],
            ),
        )

        created.append(d)
        print(f"  ✓  Dr. {d['first_name']} {d['last_name']} ({d['email']})")

    if skipped:
        print(f"\n  ⚠  Skipped (already exist): {', '.join(skipped)}")

    print(f"\n  Done — {len(created)} created, {len(skipped)} skipped.\n")


if __name__ == '__main__':
    seed()
