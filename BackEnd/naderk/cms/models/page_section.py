from django.db import models


class PageSection(models.Model):
    """
    An editable block of marketing copy on a public page.

    Page content lived in TypeScript constant files — about.constants.ts alone
    is 168 lines — so changing a headline or a picture needed a developer and a
    deploy. Rather than a model per page, each section stores its fields as JSON
    against a key, and PAGE_SCHEMAS (naderk/cms/page_schemas.py) declares what
    those fields are so the admin can render a real form instead of a JSON box.

    Adding a section is a schema entry, not a migration.
    """

    class Page(models.TextChoices):
        ABOUT = 'about', 'About'
        LABORATORY = 'laboratory', 'Laboratory'
        TELEHEALTH = 'telehealth', 'Telehealth'
        OPTICAL_STORE = 'optical_store', 'Optical Store'
        CONTACT = 'contact', 'Contact'
        HOME = 'home', 'Home'

    page = models.CharField(max_length=40, choices=Page.choices)
    section_key = models.CharField(max_length=60)
    content = models.JSONField(default=dict, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['page', 'order']
        constraints = [
            models.UniqueConstraint(
                fields=['page', 'section_key'], name='unique_page_section'
            )
        ]

    def __str__(self):
        return f"{self.get_page_display()} — {self.section_key}"
