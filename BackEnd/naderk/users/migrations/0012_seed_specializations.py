from django.db import migrations

# The four specializations that were hardcoded on DoctorProfile.Specialization
# before the table existed. Seeding them keeps every existing doctor and service
# valid — their stored codes are unchanged, they just resolve through the table now.
BUILT_INS = [
    ('OPTOMETRIST', 'Optometrist'),
    ('OPHTHALMOLOGIST', 'Ophthalmologist'),
    ('ENT', 'ENT Specialist'),
    ('GENERAL_PRACTITIONER', 'General Practitioner'),
]


def seed(apps, schema_editor):
    Specialization = apps.get_model('users', 'Specialization')
    DoctorProfile = apps.get_model('users', 'DoctorProfile')
    MedicalService = apps.get_model('appointments', 'MedicalService')

    for code, name in BUILT_INS:
        Specialization.objects.get_or_create(code=code, defaults={'name': name})

    # Pick up any code already in use that isn't a built-in (hand-edited rows,
    # older seeds), so no existing doctor or service is left pointing at nothing.
    in_use = set(
        DoctorProfile.objects.exclude(specialization='')
        .exclude(specialization=None)
        .values_list('specialization', flat=True)
    ) | set(
        MedicalService.objects.exclude(required_specialization='')
        .exclude(required_specialization=None)
        .values_list('required_specialization', flat=True)
    )
    for code in in_use:
        Specialization.objects.get_or_create(
            code=code, defaults={'name': code.replace('_', ' ').title()},
        )


def unseed(apps, schema_editor):
    Specialization = apps.get_model('users', 'Specialization')
    Specialization.objects.filter(code__in=[c for c, _ in BUILT_INS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_specialization_alter_doctorprofile_specialization'),
        ('appointments', '0010_alter_medicalservice_required_specialization'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
