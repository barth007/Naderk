"""
Point the seeded hero slides' buttons at real pages.

seed_cms created the "Back to School Screenings" slide with its button going to
/coming-soon. The slide lives in the database, so fixing the seed alone leaves
every existing site still linking there. Only links that are exactly
/coming-soon are touched, so a link an admin has chosen is kept.
"""
from django.db import migrations

BOOKING = '/dashboard/appointments/book'


def forwards(apps, schema_editor):
    HeroSlide = apps.get_model('cms', 'HeroSlide')
    HeroSlide.objects.filter(cta_primary_link='/coming-soon').update(cta_primary_link=BOOKING)
    HeroSlide.objects.filter(cta_secondary_link='/coming-soon').update(cta_secondary_link=BOOKING)


class Migration(migrations.Migration):

    dependencies = [
        ('cms', '0008_alter_pagesection_page'),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
