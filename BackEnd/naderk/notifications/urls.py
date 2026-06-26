from django.urls import path
from . import apis

urlpatterns = [
    path('', apis.NotificationListApi.as_view(), name='notifications-list'),
    path('<uuid:pk>/read/', apis.NotificationReadApi.as_view(), name='notification-read'),
]
