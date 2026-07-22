from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('appointments', '0005_medicalservice_requires_doctor'),
    ]

    operations = [
        migrations.AddField(
            model_name='medicalservice',
            name='available_online',
            field=models.BooleanField(
                default=False,
                help_text='If True and requires_doctor is True, patients can choose physical or telehealth.',
            ),
        ),
    ]
