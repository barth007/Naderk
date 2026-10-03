"""
Field definitions for editable page sections.

PageSection stores content as JSON, and these schemas say what that JSON holds
so the admin can render a real form — labelled inputs, textareas, image
pickers, repeatable rows — instead of asking someone to hand-edit JSON.

Adding a section here makes it editable. No migration is involved.

Field types the admin understands:
    text      single line
    textarea  multi-line
    image     URL, shown with the existing uploader
    list      repeatable rows, described by `fields`
"""

PAGE_SCHEMAS = {
    'about': {
        'label': 'About',
        'sections': [
            {
                'key': 'hero',
                'label': 'Hero',
                'fields': [
                    {'name': 'badge', 'label': 'Badge', 'type': 'text'},
                    {'name': 'title', 'label': 'Title', 'type': 'text'},
                    {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                    {'name': 'image', 'label': 'Image', 'type': 'image'},
                    {'name': 'imageAlt', 'label': 'Image alt text', 'type': 'text'},
                ],
            },
            {
                'key': 'vision_mission',
                'label': 'Vision & Mission',
                'fields': [
                    {'name': 'label', 'label': 'Section label', 'type': 'text'},
                    {'name': 'vision_title', 'label': 'Vision title', 'type': 'text'},
                    {'name': 'vision_description', 'label': 'Vision', 'type': 'textarea'},
                    {'name': 'mission_title', 'label': 'Mission title', 'type': 'text'},
                    {'name': 'mission_description', 'label': 'Mission', 'type': 'textarea'},
                    {'name': 'image', 'label': 'Image', 'type': 'image'},
                    {'name': 'imageAlt', 'label': 'Image alt text', 'type': 'text'},
                    {
                        'name': 'stats', 'label': 'Statistics', 'type': 'list',
                        'fields': [
                            {'name': 'value', 'label': 'Value', 'type': 'text'},
                            {'name': 'label', 'label': 'Label', 'type': 'text'},
                        ],
                    },
                ],
            },
            {
                'key': 'core_pillars',
                'label': 'Core Pillars',
                'fields': [
                    {'name': 'title', 'label': 'Title', 'type': 'text'},
                    {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                    {
                        'name': 'pillars', 'label': 'Pillars', 'type': 'list',
                        'fields': [
                            {'name': 'title', 'label': 'Title', 'type': 'text'},
                            {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                            {'name': 'icon', 'label': 'Icon key', 'type': 'text',
                             'help': 'shield, users, electricity, eye, microscope, video, glasses'},
                        ],
                    },
                ],
            },
            {
                'key': 'team_intro',
                'label': 'Team Section Heading',
                # The members themselves are already CMS-managed under the Team
                # tab; this is only the copy above them.
                'fields': [
                    {'name': 'label', 'label': 'Label', 'type': 'text'},
                    {'name': 'title', 'label': 'Title', 'type': 'text'},
                    {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                ],
            },
            {
                'key': 'promise_mandate',
                'label': 'Promise Mandate',
                'fields': [
                    {'name': 'title', 'label': 'Title', 'type': 'text'},
                    {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                    {'name': 'primary_cta_label', 'label': 'Primary button text', 'type': 'text'},
                    {'name': 'primary_cta_href', 'label': 'Primary button link', 'type': 'text'},
                    {'name': 'secondary_cta_label', 'label': 'Secondary button text', 'type': 'text'},
                    {'name': 'secondary_cta_href', 'label': 'Secondary button link', 'type': 'text'},
                ],
            },
        ],
    },
}

# Extend Life Africa (/extend-life-africa): the charity programme's page. The
# donation form and volunteer form are built into the page; this is their copy.
PAGE_SCHEMAS['extend_life_africa'] = {
    'label': 'Extend Life Africa',
    'sections': [
        {
            'key': 'hero',
            'label': 'Hero',
            'fields': [
                {'name': 'badge', 'label': 'Badge', 'type': 'text'},
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'highlight', 'label': 'Title, second line (in red)', 'type': 'text'},
                {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                {'name': 'primary_cta_label', 'label': 'Main button text', 'type': 'text'},
                {'name': 'secondary_cta_label', 'label': 'Second button text', 'type': 'text'},
                {
                    'name': 'highlights', 'label': 'Highlights under the buttons', 'type': 'list',
                    'fields': [{'name': 'label', 'label': 'Label', 'type': 'text'}],
                },
            ],
        },
        {
            'key': 'giving',
            'label': 'Giving: prices and amounts',
            'fields': [
                {'name': 'card_title', 'label': 'Donation card title', 'type': 'text'},
                {'name': 'test_price_ngn', 'label': 'Price of a test (₦)', 'type': 'text'},
                {'name': 'test_price_gbp', 'label': 'Price of a test (£)', 'type': 'text'},
                {'name': 'test_price_usd', 'label': 'Price of a test ($)', 'type': 'text'},
                {'name': 'intervention_price_ngn', 'label': 'Price of an intervention (₦)', 'type': 'text'},
                {'name': 'intervention_price_gbp', 'label': 'Price of an intervention (£)', 'type': 'text'},
                {'name': 'intervention_price_usd', 'label': 'Price of an intervention ($)', 'type': 'text'},
                {'name': 'amounts_ngn', 'label': 'Suggested amounts (₦)', 'type': 'text',
                 'help': 'Six amounts, separated by commas'},
                {'name': 'amounts_gbp', 'label': 'Suggested amounts (£)', 'type': 'text',
                 'help': 'Six amounts, separated by commas'},
                {'name': 'amounts_usd', 'label': 'Suggested amounts ($)', 'type': 'text',
                 'help': 'Six amounts, separated by commas'},
            ],
        },
        {
            'key': 'ways_to_give',
            'label': 'Ways to give',
            'fields': [
                {'name': 'label', 'label': 'Section label', 'type': 'text'},
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                {'name': 'test_title', 'label': 'Test card: title', 'type': 'text'},
                {'name': 'test_description', 'label': 'Test card: description', 'type': 'textarea'},
                {'name': 'intervention_title', 'label': 'Intervention card: title', 'type': 'text'},
                {'name': 'intervention_description', 'label': 'Intervention card: description', 'type': 'textarea'},
                {'name': 'general_title', 'label': 'Any amount card: title', 'type': 'text'},
                {'name': 'general_description', 'label': 'Any amount card: description', 'type': 'textarea'},
            ],
        },
        {
            'key': 'who_we_are',
            'label': 'Who we are',
            'fields': [
                {'name': 'label', 'label': 'Section label', 'type': 'text'},
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'quote', 'label': 'Pull quote', 'type': 'textarea'},
                {'name': 'body', 'label': 'Body', 'type': 'textarea',
                 'help': 'Leave a blank line between paragraphs'},
                {
                    'name': 'highlights', 'label': 'Highlights', 'type': 'list',
                    'fields': [
                        {'name': 'title', 'label': 'Title', 'type': 'text'},
                        {'name': 'description', 'label': 'Description', 'type': 'text'},
                    ],
                },
            ],
        },
        {
            'key': 'what_we_do',
            'label': 'What we do',
            'fields': [
                {'name': 'label', 'label': 'Section label', 'type': 'text'},
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                {
                    'name': 'pillars', 'label': 'Areas of work', 'type': 'list',
                    'fields': [
                        {'name': 'title', 'label': 'Title', 'type': 'text'},
                        {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                    ],
                },
                {'name': 'conditions_label', 'label': 'Conditions: heading', 'type': 'text'},
                {
                    'name': 'conditions', 'label': 'Conditions', 'type': 'list',
                    'fields': [{'name': 'name', 'label': 'Condition', 'type': 'text'}],
                },
                {'name': 'journey_title', 'label': 'Journey: heading', 'type': 'text'},
                {
                    'name': 'journey', 'label': 'Journey steps', 'type': 'list',
                    'fields': [
                        {'name': 'title', 'label': 'Title', 'type': 'text'},
                        {'name': 'description', 'label': 'Description', 'type': 'text'},
                    ],
                },
            ],
        },
        {
            'key': 'volunteer',
            'label': 'Volunteer',
            'fields': [
                {'name': 'label', 'label': 'Section label', 'type': 'text'},
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                {'name': 'commitment', 'label': 'Commitment', 'type': 'text'},
                {'name': 'cta_label', 'label': 'Button text', 'type': 'text'},
            ],
        },
        {
            'key': 'resources',
            'label': 'Resources',
            'fields': [
                {'name': 'label', 'label': 'Section label', 'type': 'text'},
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'link_label', 'label': '"See all" link text', 'type': 'text'},
                {'name': 'link_href', 'label': '"See all" link', 'type': 'text'},
                {
                    'name': 'items', 'label': 'Resources', 'type': 'list',
                    'fields': [
                        {'name': 'title', 'label': 'Title', 'type': 'text'},
                        {'name': 'summary', 'label': 'Summary', 'type': 'text'},
                        {'name': 'image', 'label': 'Image', 'type': 'image'},
                        {'name': 'href', 'label': 'Link', 'type': 'text'},
                    ],
                },
            ],
        },
        {
            'key': 'trustees',
            'label': 'Trustees',
            'fields': [
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {
                    'name': 'members', 'label': 'Trustees', 'type': 'list',
                    'fields': [
                        {'name': 'name', 'label': 'Name', 'type': 'text'},
                        {'name': 'role', 'label': 'Role', 'type': 'text'},
                        {'name': 'image', 'label': 'Photo', 'type': 'image'},
                    ],
                },
            ],
        },
        {
            'key': 'contact',
            'label': 'Contact',
            'fields': [
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'ng_label', 'label': 'Nigeria line: label', 'type': 'text'},
                {'name': 'ng_phone', 'label': 'Nigeria line: number', 'type': 'text'},
                {'name': 'uk_label', 'label': 'UK line: label', 'type': 'text'},
                {'name': 'uk_phone', 'label': 'UK line: number', 'type': 'text'},
                {'name': 'email', 'label': 'Email', 'type': 'text'},
            ],
        },
        {
            'key': 'closing',
            'label': 'Closing call to action',
            'fields': [
                {'name': 'title', 'label': 'Title', 'type': 'text'},
                {'name': 'description', 'label': 'Description', 'type': 'textarea'},
                {'name': 'primary_cta_label', 'label': 'Main button text', 'type': 'text'},
                {'name': 'secondary_cta_label', 'label': 'Second button text', 'type': 'text'},
            ],
        },
    ],
}


def schema_for(page: str):
    return PAGE_SCHEMAS.get(page)


def section_schema(page: str, section_key: str):
    schema = PAGE_SCHEMAS.get(page)
    if not schema:
        return None
    return next((s for s in schema['sections'] if s['key'] == section_key), None)
