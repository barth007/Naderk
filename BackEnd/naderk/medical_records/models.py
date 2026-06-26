import uuid
from django.db import models
from django.conf import settings

class ConsultationEncounter(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='consultation_encounters_as_patient'
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='consultation_encounters_as_doctor'
    )
    appointment = models.ForeignKey(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consultation_encounters'
    )
    telehealth_session = models.ForeignKey(
        'telehealth.TelehealthSession',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='consultation_encounters'
    )
    notes = models.TextField(blank=True, null=True)
    diagnosis = models.TextField(blank=True, null=True)
    clinical_findings = models.TextField(blank=True, null=True)
    reference_number = models.CharField(max_length=50, unique=True, blank=True, null=True)
    recommendations = models.TextField(blank=True, null=True)
    follow_up_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Encounter for {self.patient.email} by Dr. {self.doctor.last_name} on {self.created_at.date()}"

    def save(self, *args, **kwargs):
        if not self.reference_number:
            import datetime
            import random
            year = datetime.date.today().year
            rand = random.randint(100, 999)
            self.reference_number = f"ENC-{year}-{rand}"
            while ConsultationEncounter.objects.filter(reference_number=self.reference_number).exists():
                rand = random.randint(1000, 9999)
                self.reference_number = f"ENC-{year}-{rand}"
        super().save(*args, **kwargs)


class DiagnosticResult(models.Model):
    class Status(models.TextChoices):
        READY = 'READY', 'Ready'
        PENDING = 'PENDING', 'Pending'
        REVIEW_REQUIRED = 'REVIEW_REQUIRED', 'Review Required'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='diagnostic_results'
    )
    encounter = models.ForeignKey(
        ConsultationEncounter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='diagnostics'
    )
    test_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.PENDING)
    result_summary = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.test_name} for {self.patient.email} ({self.status})"


class DiagnosticAttachment(models.Model):
    class FileType(models.TextChoices):
        PDF = 'PDF', 'PDF'
        IMAGE = 'IMAGE', 'Image'
        OCT_SCAN = 'OCT_SCAN', 'OCT Scan'
        LAB_REPORT = 'LAB_REPORT', 'Lab Report'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    diagnostic_result = models.ForeignKey(
        DiagnosticResult,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.URLField(max_length=1000)
    file_type = models.CharField(max_length=50, choices=FileType.choices, default=FileType.PDF)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.file_type}) for {self.diagnostic_result.test_name}"


class MedicalScan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='medical_scans'
    )
    encounter = models.ForeignKey(
        ConsultationEncounter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='scans'
    )
    scan_type = models.CharField(max_length=100)
    image = models.URLField(max_length=1000)
    captured_at = models.DateField()
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_scans'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.scan_type} for {self.patient.email} on {self.captured_at}"


class Medication(models.Model):
    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='medications'
    )
    encounter = models.ForeignKey(
        ConsultationEncounter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='medications'
    )
    prescribed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='prescribed_medications'
    )
    name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100)
    frequency = models.CharField(max_length=100)
    status = models.CharField(max_length=50, choices=Status.choices, default=Status.ACTIVE)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} for {self.patient.email} ({self.status})"
