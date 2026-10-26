from django.contrib import admin

from .models import Donation, VolunteerApplication


@admin.register(Donation)
class DonationAdmin(admin.ModelAdmin):
    list_display = ('donor_name', 'donor_email', 'currency', 'amount', 'frequency', 'purpose', 'status', 'created_at')
    list_filter = ('status', 'frequency', 'currency', 'purpose')
    search_fields = ('donor_name', 'donor_email', 'payment_reference')
    readonly_fields = ('payment_reference', 'paid_at', 'reminder_sent_at', 'created_at', 'updated_at')


@admin.register(VolunteerApplication)
class VolunteerApplicationAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'email', 'role', 'session_format', 'status', 'created_at')
    list_filter = ('status', 'role', 'session_format')
    search_fields = ('full_name', 'email', 'registration_number')
