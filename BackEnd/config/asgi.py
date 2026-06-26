"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from naderk.messaging.middleware import JWTAuthMiddleware
from naderk.messaging.routing import websocket_urlpatterns as messaging_patterns
from naderk.telehealth.routing import websocket_urlpatterns as telehealth_patterns

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            messaging_patterns + telehealth_patterns
        )
    ),
})

