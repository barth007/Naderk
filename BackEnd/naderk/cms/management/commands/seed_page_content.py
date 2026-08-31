from django.core.management.base import BaseCommand

from naderk.cms.models import PageSection

#: The copy currently living in about.constants.ts, so the first edit starts
#: from what the site already says rather than an empty form.
ABOUT_SECTIONS = {
    'hero': {
        'badge': 'About NaderkEye Center',
        'title': 'Our Identity & Commitment',
        'description': (
            'Naderk Eye Centre is a purpose-driven multispecialty healthcare '
            'institution, dedicated to transforming the landscape of eye care, '
            'diagnostics, preventive healthcare, and telehealth across Africa.'
        ),
        'image': '/images/image 13.png',
        'imageAlt': 'Microscope lenses in a modern eye care clinic',
    },
    'vision_mission': {
        'label': 'Our Legacy',
        'vision_title': 'Our Vision',
        'vision_description': (
            'To become a leading and sustainable centre of excellence in eye care, '
            'diagnostics, preventive healthcare, and multispecialty health services '
            'across Africa, recognised for innovation, compassion, and transformative impact.'
        ),
        'mission_title': 'Our Mission',
        'mission_description': (
            'To deliver integrated, compassionate, and technologically advanced healthcare '
            'services that preserve sight, champion early disease detection, promote wellness, '
            'and empower communities. We achieve this by fostering a culture of respect, '
            'leveraging innovation, and remaining steadfast in our commitment to a higher purpose.'
        ),
        'image': '/images/image 11.png',
        'imageAlt': 'Ophthalmologist standing beside eye examination equipment',
        'stats': [
            {'value': '12+', 'label': 'Years of Experience'},
            {'value': '30+', 'label': 'Specialist Team Members'},
            {'value': '50K+', 'label': 'Patients Supported'},
            {'value': '20+', 'label': 'Partner Clinics'},
        ],
    },
    'core_pillars': {
        'title': 'Our Core Pillars: The Triad of Our Identity',
        'description': (
            'At the heart of our organisation lies a powerful tripartite philosophy '
            'that guides every decision and action'
        ),
        'pillars': [
            {
                'title': 'Deity - Our Source and Foundation',
                'description': (
                    'We operate with the profound belief that our work serves a greater good. '
                    'This spiritual foundation provides our team with purpose, resilience, and '
                    'a moral compass.'
                ),
                'icon': 'shield',
            },
            {
                'title': 'Humanity - People at the Heart of Our Work',
                'description': (
                    'We foster an ecosystem of dignity and respect for our patients, our '
                    'dedicated staff, and our stakeholders. We honour every individual with '
                    'care and compassion.'
                ),
                'icon': 'users',
            },
            {
                'title': 'Technology - Innovation that Transforms Care',
                'description': (
                    'We embrace cutting-edge technology as a catalyst for transformation. By '
                    'leveraging diagnostics and telehealth, we deliver measurable care outcomes.'
                ),
                'icon': 'electricity',
            },
        ],
    },
    'team_intro': {
        'label': 'Our Team',
        'title': 'Meet Our Expert Team',
        'description': 'Specialists dedicated to your vision.',
    },
    'promise_mandate': {
        'title': 'The Promise Mandate',
        'description': (
            'At Naderk Eye Centre, we are more than a healthcare provider; we are a beacon of '
            'hope, healing, and transformation. Guided by compassion and empowered by technology, '
            'we are dedicated to restoring sight, improving health, and enriching lives across '
            'Africa and beyond.'
        ),
        'primary_cta_label': 'Book Your Consultation',
        'primary_cta_href': '/dashboard/appointments/book',
        'secondary_cta_label': 'View Our Services',
        'secondary_cta_href': '/services/telehealth',
    },
}

PAGES = {'about': ABOUT_SECTIONS}


class Command(BaseCommand):
    help = (
        "Load the page copy that currently lives in the frontend constants into "
        "editable PageSection rows. Idempotent: existing sections are left alone "
        "unless --overwrite is passed, so a re-run cannot undo someone's edits."
    )

    def add_arguments(self, parser):
        parser.add_argument('--page', help='Only seed this page.')
        parser.add_argument(
            '--overwrite', action='store_true',
            help='Replace sections that already exist. Discards edits made in the admin.',
        )

    def handle(self, *args, **options):
        only = options.get('page')
        overwrite = options['overwrite']
        created = updated = skipped = 0

        for page, sections in PAGES.items():
            if only and page != only:
                continue
            for order, (key, content) in enumerate(sections.items()):
                existing = PageSection.objects.filter(page=page, section_key=key).first()
                if existing and not overwrite:
                    skipped += 1
                    continue
                if existing:
                    existing.content = content
                    existing.order = order
                    existing.save(update_fields=['content', 'order'])
                    updated += 1
                else:
                    PageSection.objects.create(
                        page=page, section_key=key, content=content, order=order,
                    )
                    created += 1
                self.stdout.write(f"  {page}/{key}")

        self.stdout.write(self.style.SUCCESS(
            f"\ncreated {created}, updated {updated}, left alone {skipped}"
        ))
        if skipped and not overwrite:
            self.stdout.write("Re-run with --overwrite to replace the untouched ones.")
