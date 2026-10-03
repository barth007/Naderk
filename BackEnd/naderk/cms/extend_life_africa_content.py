"""
Starting copy for the Extend Life Africa page, from ELA's own write-up.

Seeded into PageSection rows by `manage.py seed_page_content`, so the admin's
form opens filled in rather than empty. The frontend keeps the same text as its
fallback (components/page/extend-life-africa/ela.constants.ts); keep the two in
step when changing the defaults here. Contact details are placeholders until
the charity supplies its own.
"""

EXTEND_LIFE_AFRICA_SECTIONS = {
    'hero': {
        'badge': 'A charity for preventive health across Africa',
        'title': 'Extend a life.',
        'highlight': 'Start with one test.',
        'description': (
            'Chronic diseases like diabetes and hypertension often go undetected until it is '
            'too late. A single test, sponsored by you, can catch them early — and give someone '
            'the chance to take control of their health before disease takes control of them.'
        ),
        'primary_cta_label': 'Sponsor a test',
        'secondary_cta_label': 'Volunteer your time',
        'highlights': [
            {'label': 'Point-of-care testing'},
            {'label': 'Telemedicine'},
            {'label': 'Health education'},
        ],
    },
    'giving': {
        'card_title': 'Make a gift',
        'test_price_ngn': '9999',
        'test_price_gbp': '5',
        'test_price_usd': '6.50',
        'intervention_price_ngn': '20000',
        'intervention_price_gbp': '10',
        'intervention_price_usd': '13',
        'amounts_ngn': '9999, 20000, 50000, 100000, 150000, 250000',
        'amounts_gbp': '5, 10, 25, 50, 100, 250',
        'amounts_usd': '6.50, 13, 30, 60, 120, 300',
    },
    'ways_to_give': {
        'label': 'Get involved',
        'title': 'Three ways to extend a life',
        'description': (
            'Every gift goes into early detection and prevention — before a chronic condition '
            'becomes a crisis.'
        ),
        'test_title': 'Sponsor a test',
        'test_description': (
            'Fund one point-of-care screening that can catch diabetes, hypertension or heart '
            'disease early.'
        ),
        'intervention_title': 'Sponsor an intervention',
        'intervention_description': (
            'Go beyond the result: fund the personalised follow-up care that helps someone '
            'manage, or even reverse, their condition.'
        ),
        'general_title': 'Donate any amount',
        'general_description': (
            'Give once or every year. Your gift supports health promotion, diagnostics and '
            'telemedicine wherever it is needed most.'
        ),
    },
    'who_we_are': {
        'label': 'Who we are',
        'title': 'From treatment to prevention',
        'quote': (
            'Chronic diseases may not be inevitable, but with the right tools, guidance, and '
            'technology, they can be managed, prevented, or even reversed.'
        ),
        'body': (
            'Extend Life Africa (ELA) is a charitable organisation on a mission to transform '
            'healthcare across the continent by empowering individuals with information and the '
            'solutions to take control of their health and well-being. We promote early disease '
            'detection and behavioural changes to reverse chronic diseases.\n\n'
            'Africa faces a growing burden of chronic diseases such as diabetes, hypertension and '
            "cardiovascular conditions, which often go undetected until it's too late. We believe "
            'the key to a healthier Africa lies in early detection, proactive care, and health '
            'education.\n\n'
            'By leveraging state-of-the-art Point-of-Care testing, AI-powered health insights, '
            'telemedicine and health education — and the magnanimity of Lovers of Africa — we can '
            'help people live healthier, longer lives, and make quality preventive care available '
            'to all, regardless of socioeconomic status.'
        ),
        'highlights': [
            {'title': 'Early detection', 'description': 'Find it before it finds you.'},
            {'title': 'Proactive care', 'description': 'Act on results, early.'},
            {'title': 'Health education', 'description': 'Knowledge that changes habits.'},
        ],
    },
    'what_we_do': {
        'label': 'What we do',
        'title': 'Healthcare that acts before illness takes hold',
        'description': (
            'We champion primary care, eye care, early testing and preventive healthcare to '
            'prevent or manage non-communicable diseases.'
        ),
        'pillars': [
            {'title': 'Health promotion', 'description': (
                'Education and behaviour change that help individuals, families and communities '
                'take control of their health.')},
            {'title': 'Diagnostics', 'description': (
                'Cutting-edge point-of-care testing that finds chronic disease early, close to '
                'where people live.')},
            {'title': 'MedTech & telemedicine', 'description': (
                'Technology-driven, personalised interventions that bring clinicians to patients, '
                'wherever they are.')},
        ],
        'conditions_label': 'Conditions we focus on',
        'conditions': [
            {'name': 'Diabetes'}, {'name': 'Hypertension'}, {'name': 'Cardiovascular disease'},
            {'name': 'Eye health'}, {'name': 'Other chronic conditions'},
        ],
        'journey_title': 'Where your gift goes',
        'journey': [
            {'title': 'Screened early', 'description': 'A point-of-care test spots risk before symptoms appear.'},
            {'title': 'Seen by a clinician', 'description': 'A virtual consultation explains the result and the options.'},
            {'title': 'Supported to change', 'description': 'A personalised intervention helps manage or reverse the condition.'},
        ],
    },
    'volunteer': {
        'label': 'Volunteer',
        'title': "Give one hour a week. Change someone's next ten years.",
        'description': (
            'Offer your expertise as a GP, nurse or nutritionist through short virtual '
            'consultations with patients — from wherever you are.'
        ),
        'commitment': '1 hour / week',
        'cta_label': 'Offer your time',
    },
    'resources': {
        'label': 'Resources',
        'title': 'Learn to stay ahead of your health',
        'link_label': 'All articles',
        'link_href': '/blog',
        'items': [],
    },
    'trustees': {
        'title': 'The trustees',
        'members': [
            {'name': 'Ellis Emwanta', 'role': 'Trustee', 'image': ''},
            {'name': 'Helen Gbinigie', 'role': 'Trustee', 'image': ''},
            {'name': 'Egbe Emwanta', 'role': 'Trustee', 'image': ''},
            {'name': 'Joyce Nwatuobi', 'role': 'Trustee', 'image': ''},
        ],
    },
    'contact': {
        'title': 'Contact us',
        'ng_label': 'Nigeria (MTN)',
        'ng_phone': '+234 000 000 0000',
        'uk_label': 'United Kingdom',
        'uk_phone': '+44 0000 000000',
        'email': 'info@example.org',
    },
    'closing': {
        'title': 'Not just more years — better ones.',
        'description': (
            'ELA is redefining healthcare by extending the quality of life lived, not just the '
            'years. Join us in helping people stay ahead of health challenges before they become '
            'life-threatening. Your future health starts now.'
        ),
        'primary_cta_label': 'Donate now',
        'secondary_cta_label': 'Volunteer',
    },
}
