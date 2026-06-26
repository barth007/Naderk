from django.urls import path
from . import apis
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('register/', apis.RegisterAPI.as_view(), name='auth-register'),
    path('login/', apis.LoginAPI.as_view(), name='auth-login'),
    path('verify-otp/', apis.VerifyOTPAPI.as_view(), name='auth-verify-otp'),
    path('resend-otp/', apis.ResendOTPAPI.as_view(), name='auth-resend-otp'),
    path('me/', apis.MeAPI.as_view(), name='auth-me'),
    path('change-password/', apis.ChangePasswordAPI.as_view(), name='auth-change-password'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]
