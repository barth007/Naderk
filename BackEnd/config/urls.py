"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse


def health_check(request):
    return JsonResponse({"status": "ok"})


def api_root(request):
    """
    Landing response for the bare API host.

    Nothing was routed at `/`, and the API vhosts only proxied `/api/`,
    `/admin/` and `/ws/`, so hitting https://dev-api.naderkela.com/ fell through
    to nginx's default site and showed the stock "Welcome to nginx!" page — which
    looks like the deployment is broken. This gives the host an identity and a
    couple of useful pointers.
    """
    from django.conf import settings

    brand = getattr(settings, 'BRAND_NAME', 'Naderk')
    try:
        # Prefer the name the CMS is configured with, so renaming the platform
        # is reflected here too. Never let this take the endpoint down.
        from naderk.cms.models import SiteSettings
        configured = SiteSettings.objects.values_list('company_name', flat=True).first()
        if configured:
            brand = configured
    except Exception:
        pass

    return JsonResponse({
        "message": f"Welcome to the {brand} API.",
        "status": "ok",
        "api_root": "/api/v1/",
        "health": "/api/health/",
        "admin": "/admin/",
    })


urlpatterns = [
    path('', api_root, name='api-root'),
    path('api/health/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('naderk.authentication.urls')),
    path('api/v1/users/', include('naderk.users.urls')),
    path('api/v1/cms/', include('naderk.cms.urls')),
    path('api/v1/appointments/', include('naderk.appointments.urls')),
    path('api/v1/messages/', include('naderk.messaging.urls')),
    path('api/v1/notifications/', include('naderk.notifications.urls')),
    path('api/v1/telehealth/', include('naderk.telehealth.urls')),
    path('api/v1/marketplace/', include('naderk.ecommerce.urls')),
    path('api/v1/dashboard/', include('naderk.dashboard.urls')),
    path('api/v1/medical-records/', include('naderk.medical_records.urls')),
    path('api/v1/payments/', include('naderk.payments.urls')),
    path('api/v1/storage/',   include('naderk.storage.urls')),
    path('api/v1/webhooks/email/', include('naderk.common.email.urls')),
]

