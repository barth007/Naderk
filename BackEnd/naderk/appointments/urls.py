from django.urls import path
from . import apis

urlpatterns = [
    path('services/', apis.MedicalServiceListApi.as_view(), name='medical-services'),
    path('assign-specialist/', apis.AssignSpecialistApi.as_view(), name='assign-specialist'),
    path('available-slots/', apis.AvailableSlotsApi.as_view(), name='available-slots'),
    path('reserve-slot/', apis.ReserveSlotApi.as_view(), name='reserve-slot'),
    path('create/', apis.CreateAppointmentApi.as_view(), name='create-appointment'),
    path('history/', apis.AppointmentHistoryApi.as_view(), name='appointment-history'),
    path('<uuid:pk>/cancel/', apis.CancelAppointmentApi.as_view(), name='cancel-appointment'),
    path('<uuid:pk>/reschedule/', apis.RescheduleAppointmentApi.as_view(), name='reschedule-appointment'),
    path('<uuid:pk>/check-in/', apis.CheckInAppointmentApi.as_view(), name='check-in-appointment'),
    path('<uuid:pk>/start/', apis.StartAppointmentApi.as_view(), name='start-appointment'),
    path('<uuid:pk>/complete/', apis.CompleteAppointmentApi.as_view(), name='complete-appointment'),
    path('<uuid:pk>/', apis.AppointmentDetailApi.as_view(), name='appointment-detail'),
]
