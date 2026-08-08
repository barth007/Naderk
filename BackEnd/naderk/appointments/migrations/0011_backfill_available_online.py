from django.db import migrations


def backfill(apps, schema_editor):
    """
    Before available_online was enforced, the booking wizard offered telehealth
    for every doctor-required service regardless of this flag — so it sat at its
    False default on every existing row. Now that the flag is authoritative,
    leaving those rows alone would silently remove telehealth from the entire
    product.

    Turn it on for the doctor-required services that already existed, which
    restores exactly the behaviour patients had before enforcement. Admins can
    now switch it off per service, and new services still default to False.
    """
    MedicalService = apps.get_model('appointments', 'MedicalService')
    MedicalService.objects.filter(
        requires_doctor=True, available_online=False,
    ).update(available_online=True)


def unbackfill(apps, schema_editor):
    # Not reversible in a meaningful way: we can't tell which rows were
    # deliberately set True after this ran from the ones this migration set.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('appointments', '0010_alter_medicalservice_required_specialization'),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
