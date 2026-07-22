from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('appointments', '0004_add_service_billing_and_plan'),
    ]

    operations = [
        migrations.AddField(
            model_name='medicalservice',
            name='requires_doctor',
            field=models.BooleanField(
                default=True,
                help_text='If False, service is facility-based (e.g. lab test) and does not require a doctor',
            ),
        ),
        migrations.AlterField(
            model_name='medicalservice',
            name='required_specialization',
            field=models.CharField(
                blank=True,
                choices=[
                    ('GENERAL_PRACTICE', 'General Practice'),
                    ('PEDIATRICS', 'Pediatrics'),
                    ('CARDIOLOGY', 'Cardiology'),
                    ('DERMATOLOGY', 'Dermatology'),
                    ('NEUROLOGY', 'Neurology'),
                    ('ONCOLOGY', 'Oncology'),
                    ('ORTHOPEDICS', 'Orthopedics'),
                    ('PSYCHIATRY', 'Psychiatry'),
                    ('RADIOLOGY', 'Radiology'),
                    ('SURGERY', 'Surgery'),
                    ('UROLOGY', 'Urology'),
                    ('OPHTHALMOLOGY', 'Ophthalmology'),
                    ('OPTOMETRY', 'Optometry'),
                    ('EMERGENCY_MEDICINE', 'Emergency Medicine'),
                    ('INTERNAL_MEDICINE', 'Internal Medicine'),
                    ('OBSTETRICS_GYNECOLOGY', 'Obstetrics & Gynecology'),
                    ('ANESTHESIOLOGY', 'Anesthesiology'),
                    ('PATHOLOGY', 'Pathology'),
                    ('PHYSIOTHERAPY', 'Physiotherapy'),
                    ('LABORATORY_MEDICINE', 'Laboratory Medicine'),
                ],
                help_text='Only relevant when requires_doctor is True',
                max_length=50,
                null=True,
            ),
        ),
    ]
