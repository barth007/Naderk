from django.urls import path
from .apis import (
    PatientRecordsListApi,
    PatientMedicalRecordsOverviewApi,
    EncounterListApi,
    EncounterDetailApi,
    PrescriptionListApi,
    PrescriptionPdfApi,
    DiagnosticResultListApi,
    MedicalScanListApi,
    MedicationListCreateApi,
    MedicationDetailApi,
)

urlpatterns = [
    path('patients/', PatientRecordsListApi.as_view(), name='patient-records-list'),
    path('overview/', PatientMedicalRecordsOverviewApi.as_view(), name='medical-records-overview'),
    path('encounters/', EncounterListApi.as_view(), name='encounter-list'),
    path('encounters/<uuid:pk>/', EncounterDetailApi.as_view(), name='encounter-detail'),
    path('prescriptions/', PrescriptionListApi.as_view(), name='prescription-list'),
    path('prescriptions/<uuid:pk>/pdf/', PrescriptionPdfApi.as_view(), name='prescription-pdf'),
    path('diagnostics/', DiagnosticResultListApi.as_view(), name='diagnostic-list'),
    path('scans/', MedicalScanListApi.as_view(), name='scan-list'),
    path('medications/', MedicationListCreateApi.as_view(), name='medication-list-create'),
    path('medications/<uuid:pk>/', MedicationDetailApi.as_view(), name='medication-detail'),
]
