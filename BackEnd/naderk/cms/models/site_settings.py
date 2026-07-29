from django.db import models
from django.core.exceptions import ValidationError


class SiteSettings(models.Model):
    company_name = models.CharField(max_length=150, default='Naderkela')
    logo_url = models.URLField(max_length=1000, blank=True)
    favicon_url = models.URLField(max_length=1000, blank=True)
    phone_primary = models.CharField(max_length=30, blank=True)
    phone_secondary = models.CharField(max_length=30, blank=True)
    email_support = models.EmailField(blank=True)
    email_general = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    google_maps_url = models.URLField(max_length=1000, blank=True)
    hours_weekday = models.CharField(max_length=100, blank=True)
    hours_saturday = models.CharField(max_length=100, blank=True)
    hours_sunday = models.CharField(max_length=100, blank=True)
    facebook_url = models.URLField(max_length=500, blank=True)
    twitter_url = models.URLField(max_length=500, blank=True)
    instagram_url = models.URLField(max_length=500, blank=True)
    linkedin_url = models.URLField(max_length=500, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Site Settings'
        verbose_name_plural = 'Site Settings'

    def clean(self):
        if not self.pk and SiteSettings.objects.exists():
            raise ValidationError("Only one SiteSettings instance is allowed.")

    def __str__(self):
        return "Site Settings"
