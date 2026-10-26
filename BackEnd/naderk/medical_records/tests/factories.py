"""Small builders for clinical records, shared by the pytest-style tests."""
import datetime

from naderk.medical_records.models import ConsultationEncounter, DiagnosticResult, MedicalScan, Medication


def encounter(patient, doctor, **extra):
    return ConsultationEncounter.objects.create(
        patient=patient, doctor=doctor, diagnosis=extra.pop('diagnosis', 'Mild myopia'),
        notes=extra.pop('notes', 'Stable'), **extra)


def medication(patient, doctor, name='Latanoprost', **extra):
    return Medication.objects.create(
        patient=patient, prescribed_by=doctor, name=name, dosage='1 drop', frequency='Nightly',
        start_date=datetime.date(2030, 1, 1), **extra)


def diagnostic(patient, test_name='OCT', **extra):
    return DiagnosticResult.objects.create(patient=patient, test_name=test_name, category='Imaging', **extra)


def scan(patient, uploaded_by=None, **extra):
    return MedicalScan.objects.create(
        patient=patient, scan_type='Fundus', image='https://media.naderk.test/scan.png',
        captured_at=datetime.date(2030, 1, 1), uploaded_by=uploaded_by, **extra)
