"""Small builders for appointment data, shared by the pytest-style tests."""
import datetime
from decimal import Decimal

from django.utils import timezone

from naderk.appointments.models import Appointment, MedicalService


def service(slug='consult', fee='8500.00', billing=MedicalService.BillingType.PER_VISIT,
            sessions=None, requires_doctor=True, minutes=30):
    return MedicalService.objects.create(
        name=slug.replace('-', ' ').title(), slug=slug, fee=Decimal(fee), billing_type=billing,
        sessions_included=sessions, requires_doctor=requires_doctor, duration_minutes=minutes,
    )


def appointment(patient, of, doctor=None, *, days_ahead=1, time=datetime.time(10, 0),
                status=Appointment.Status.PENDING, paid=False, fee=None,
                kind=Appointment.AppointmentType.PHYSICAL):
    return Appointment.objects.create(
        patient=patient, doctor=doctor, service=of, appointment_type=kind,
        appointment_date=timezone.localdate() + datetime.timedelta(days=days_ahead),
        appointment_time=time, status=status,
        consultation_fee=of.fee if fee is None else Decimal(fee),
        payment_status=Appointment.PaymentStatus.PAID if paid else Appointment.PaymentStatus.PENDING,
    )
