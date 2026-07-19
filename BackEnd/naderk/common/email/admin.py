from django.contrib import admin
from .models import EmailLog, EmailEvent


class EmailEventInline(admin.TabularInline):
    model = EmailEvent
    extra = 0
    readonly_fields = ('event_type', 'provider', 'timestamp', 'payload')
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display  = ('recipient', 'subject_short', 'provider', 'status',
                     'template_name', 'created_at', 'delivered_at')
    list_filter   = ('status', 'provider', 'created_at')
    search_fields = ('recipient', 'subject', 'provider_message_id')
    readonly_fields = (
        'id', 'recipient', 'subject', 'template_name',
        'provider', 'provider_message_id', 'status',
        'tags', 'metadata', 'error_message', 'sent_by',
        'created_at', 'sent_at', 'delivered_at',
        'opened_at', 'clicked_at', 'bounced_at',
        'complained_at', 'bounce_type',
    )
    inlines = [EmailEventInline]
    ordering = ('-created_at',)

    def subject_short(self, obj):
        return obj.subject[:60]
    subject_short.short_description = 'Subject'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(EmailEvent)
class EmailEventAdmin(admin.ModelAdmin):
    list_display  = ('event_type', 'provider', 'email_log', 'timestamp')
    list_filter   = ('event_type', 'provider')
    readonly_fields = ('id', 'email_log', 'event_type', 'provider', 'payload', 'timestamp')
    ordering = ('-timestamp',)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
