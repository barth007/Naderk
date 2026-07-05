import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

# Imports that touch Django models must come AFTER django.setup()
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from naderk.messaging.middleware import JWTAuthMiddleware
from naderk.messaging.routing import websocket_urlpatterns as messaging_patterns
from naderk.telehealth.routing import websocket_urlpatterns as telehealth_patterns

django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter(
            messaging_patterns + telehealth_patterns
        )
    ),
})
