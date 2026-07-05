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


urlpatterns = [
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
]

