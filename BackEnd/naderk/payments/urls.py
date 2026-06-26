from django.urls import path
from .apis import InitializePaymentApi, InitializeAppointmentPaymentApi, PaystackWebhookApi

urlpatterns = [
    path('initialize/', InitializePaymentApi.as_view(), name='payment-initialize'),
    path('initialize-appointment/', InitializeAppointmentPaymentApi.as_view(), name='payment-initialize-appointment'),
    path('webhook/paystack/', PaystackWebhookApi.as_view(), name='webhook-paystack'),
]
