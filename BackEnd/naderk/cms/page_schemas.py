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


def schema_for(page: str):
    return PAGE_SCHEMAS.get(page)


def section_schema(page: str, section_key: str):
    schema = PAGE_SCHEMAS.get(page)
    if not schema:
        return None
    return next((s for s in schema['sections'] if s['key'] == section_key), None)
