from django.urls import path
from .webhooks import (
    PostmarkDeliveryWebhook,
    PostmarkBounceWebhook,
    PostmarkSpamWebhook,
    PostmarkOpenWebhook,
    PostmarkClickWebhook,
)

urlpatterns = [
    path('postmark/delivery/', PostmarkDeliveryWebhook.as_view(), name='postmark-delivery'),
    path('postmark/bounce/',   PostmarkBounceWebhook.as_view(),   name='postmark-bounce'),
    path('postmark/spam/',     PostmarkSpamWebhook.as_view(),     name='postmark-spam'),
    path('postmark/open/',     PostmarkOpenWebhook.as_view(),     name='postmark-open'),
    path('postmark/click/',    PostmarkClickWebhook.as_view(),    name='postmark-click'),
]
