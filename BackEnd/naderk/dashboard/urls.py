from django.urls import path
from . import apis

app_name = 'dashboard'

urlpatterns = [
    path('doctor/summary/', apis.DoctorSummaryAPI.as_view(), name='doctor-summary'),
    path('doctor/calendar/', apis.DoctorCalendarAPI.as_view(), name='doctor-calendar'),
    path('doctor/appointments/', apis.DoctorAppointmentsAPI.as_view(), name='doctor-appointments'),
    path('doctor/requests/', apis.DoctorRequestsAPI.as_view(), name='doctor-requests'),
    path('doctor/requests/<uuid:pk>/accept/', apis.DoctorAcceptRequestAPI.as_view(), name='doctor-requests-accept'),
    path('doctor/requests/<uuid:pk>/reject/', apis.DoctorRejectRequestAPI.as_view(), name='doctor-requests-reject'),
    path('doctor/telehealth/', apis.DoctorTelehealthAPI.as_view(), name='doctor-telehealth'),
    path('doctor/scratchpad/', apis.DoctorScratchpadAPI.as_view(), name='doctor-scratchpad'),
    # path('', some_view),
]
