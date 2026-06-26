from django.db.models import QuerySet
from .models import Notification

def get_unread_notifications(user) -> QuerySet:
    return Notification.objects.filter(user=user, is_read=False)

def get_all_notifications(user) -> QuerySet:
    return Notification.objects.filter(user=user)
