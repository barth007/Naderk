from django.db import models


class HeroSlide(models.Model):
    class ThemeChoices(models.TextChoices):
        LIGHT = 'LIGHT', 'Light'
        DARK = 'DARK', 'Dark'

    badge_text = models.CharField(max_length=100, blank=True)
    title = models.CharField(max_length=255)
    subtitle = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    image_url = models.URLField(max_length=1000, blank=True)
    cta_primary_text = models.CharField(max_length=100, blank=True)
    cta_primary_link = models.CharField(max_length=255, blank=True)
    cta_secondary_text = models.CharField(max_length=100, blank=True)
    cta_secondary_link = models.CharField(max_length=255, blank=True)
    discount_text = models.CharField(max_length=100, blank=True)
    theme = models.CharField(max_length=10, choices=ThemeChoices.choices, default=ThemeChoices.LIGHT)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return self.title
