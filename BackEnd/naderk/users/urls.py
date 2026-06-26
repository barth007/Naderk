from django.urls import path
from . import apis

app_name = 'users'

urlpatterns = [
    path('profile/', apis.PatientProfileAPI.as_view(), name='profile'),
    path('upload-image/', apis.UploadImageAPI.as_view(), name='upload-image'),
    path('doctors/', apis.DoctorListAPI.as_view(), name='doctors-list'),
]
