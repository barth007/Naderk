import datetime
import calendar
from decimal import Decimal
from django.utils import timezone
from django.db.models import Count, Q
from naderk.users.models import DoctorProfile
from .models import Appointment, DoctorAvailability, AppointmentSlotReservation, MedicalService, PatientServicePlan

class ConsultationService:
    @staticmethod
    def calculate_fee(patient, service: MedicalService) -> Decimal:
        if ConsultationService.has_active_plan(patient, service):
            return Decimal('0.00')
        return service.fee

    @staticmethod
    def has_active_plan(patient, service: MedicalService) -> bool:
        today = timezone.now().date()
        plan = PatientServicePlan.objects.filter(
            patient=patient, service=service, is_active=True
        ).first()
        if not plan:
            return False
        if service.billing_type == MedicalService.BillingType.MONTHLY:
            return plan.valid_until is not None and plan.valid_until >= today
        if service.billing_type == MedicalService.BillingType.SESSION_PACK:
            return plan.sessions_used < plan.sessions_purchased
        return False  # PER_VISIT — never free

    @staticmethod
    def consume_session(patient, service: MedicalService) -> None:
        """Decrements SESSION_PACK uses when an appointment is completed."""
        if service.billing_type != MedicalService.BillingType.SESSION_PACK:
            return
        plan = PatientServicePlan.objects.filter(
            patient=patient, service=service, is_active=True
        ).first()
        if plan:
            plan.sessions_used += 1
            if plan.sessions_used >= plan.sessions_purchased:
                plan.is_active = False
            plan.save()

    @staticmethod
    def create_service_plan(patient, service: MedicalService, payment_reference: str) -> PatientServicePlan:
        today = timezone.now().date()
        if service.billing_type == MedicalService.BillingType.MONTHLY:
            last_day = calendar.monthrange(today.year, today.month)[1]
            valid_until = today.replace(day=last_day)
            return PatientServicePlan.objects.create(
                patient=patient,
                service=service,
                payment_reference=payment_reference,
                sessions_purchased=1,
                sessions_used=0,
                valid_from=today,
                valid_until=valid_until,
                is_active=True,
            )
        elif service.billing_type == MedicalService.BillingType.SESSION_PACK:
            return PatientServicePlan.objects.create(
                patient=patient,
                service=service,
                payment_reference=payment_reference,
                sessions_purchased=service.sessions_included or 1,
                sessions_used=0,
                valid_from=today,
                valid_until=None,
                is_active=True,
            )
        else:  # PER_VISIT
            return PatientServicePlan.objects.create(
                patient=patient,
                service=service,
                payment_reference=payment_reference,
                sessions_purchased=1,
                sessions_used=0,
                valid_from=today,
                valid_until=today,
                is_active=True,
            )

class DoctorAssignmentService:
    @staticmethod
    def assign_best_doctor(specialization, requested_date):
        weekday = requested_date.weekday()

        # Primary: doctors who have explicit availability for this weekday
        available_doctors = DoctorProfile.objects.filter(
            specialization=specialization,
            is_accepting_patients=True,
            user__availabilities__weekday=weekday,
            user__availabilities__is_active=True
        ).distinct()

        # Fallback: any accepting doctor with matching specialization
        # (covers doctors who haven't configured their schedule yet)
        if not available_doctors.exists():
            available_doctors = DoctorProfile.objects.filter(
                specialization=specialization,
                is_accepting_patients=True,
            ).distinct()

        if not available_doctors.exists():
            return None

        # 2. Calculate load for each doctor on that date
        best_doctor = None
        min_load = float('inf')

        for doc_profile in available_doctors:
            doc = doc_profile.user
            
            # Count confirmed/pending appointments
            appts_count = Appointment.objects.filter(
                doctor=doc,
                appointment_date=requested_date,
                status__in=[Appointment.Status.CONFIRMED, Appointment.Status.PENDING]
            ).count()
            
            # Check if exceeded max daily
            if appts_count >= doc_profile.max_daily_appointments:
                continue
                
            # Count active reservations
            reservations_count = AppointmentSlotReservation.objects.filter(
                doctor=doc,
                slot_datetime__date=requested_date,
                status=AppointmentSlotReservation.Status.RESERVED,
                expires_at__gt=timezone.now()
            ).count()
            
            total_load = appts_count + reservations_count
            
            if total_load < min_load:
                min_load = total_load
                best_doctor = doc
                
        return best_doctor

class AppointmentSlotService:
    @staticmethod
    def generate_available_slots(doctor, requested_date):
        weekday = requested_date.weekday()
        
        # Get availabilities for this day
        availabilities = DoctorAvailability.objects.filter(
            doctor=doctor,
            weekday=weekday,
            is_active=True
        )
        
        if not availabilities.exists():
            return []
            
        slots = []
        now = timezone.now()
        is_today = requested_date == now.date()
        
        # Get booked times
        booked_appts = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=requested_date,
            status__in=[Appointment.Status.CONFIRMED, Appointment.Status.PENDING]
        ).values_list('appointment_time', flat=True)
        
        # Get reserved times (not expired)
        reserved_slots = AppointmentSlotReservation.objects.filter(
            doctor=doctor,
            slot_datetime__date=requested_date,
            status=AppointmentSlotReservation.Status.RESERVED,
            expires_at__gt=now
        ).values_list('slot_datetime__time', flat=True)
        
        unavailable_times = set(booked_appts) | set(reserved_slots)
        
        for avail in availabilities:
            current_time = datetime.datetime.combine(requested_date, avail.start_time)
            current_time = timezone.make_aware(current_time)
            end_datetime = datetime.datetime.combine(requested_date, avail.end_time)
            end_datetime = timezone.make_aware(end_datetime)
            
            while current_time + datetime.timedelta(minutes=avail.slot_duration) <= end_datetime:
                slot_time = current_time.time()
                
                # If today, skip past slots + 30 min buffer
                if is_today and current_time < now + datetime.timedelta(minutes=30):
                    current_time += datetime.timedelta(minutes=avail.slot_duration)
                    continue
                    
                if slot_time not in unavailable_times:
                    slots.append(slot_time.strftime('%H:%M'))
                    
                current_time += datetime.timedelta(minutes=avail.slot_duration)

        return sorted(slots)

    # Standard facility operating hours for on-site services that don't need a doctor.
    FACILITY_OPEN_HOUR = 8    # 08:00
    FACILITY_CLOSE_HOUR = 17  # 17:00

    @staticmethod
    def generate_facility_slots(service, requested_date):
        """
        Slots for facility-based services (no doctor). Uses standard operating hours
        and the service duration as the slot interval. Facilities can handle parallel
        patients, so slots are only removed when THIS patient already booked that time.
        """
        slots = []
        now = timezone.now()
        is_today = requested_date == now.date()
        step = max(service.duration_minutes, 15)

        current_time = timezone.make_aware(
            datetime.datetime.combine(requested_date,
                                      datetime.time(AppointmentSlotService.FACILITY_OPEN_HOUR, 0))
        )
        end_datetime = timezone.make_aware(
            datetime.datetime.combine(requested_date,
                                      datetime.time(AppointmentSlotService.FACILITY_CLOSE_HOUR, 0))
        )

        while current_time + datetime.timedelta(minutes=service.duration_minutes) <= end_datetime:
            if not (is_today and current_time < now + datetime.timedelta(minutes=30)):
                slots.append(current_time.time().strftime('%H:%M'))
            current_time += datetime.timedelta(minutes=step)

        return slots

class DuplicateAppointmentError(Exception):
    pass

class OverlappingAppointmentError(Exception):
    pass

class PatientAppointmentValidationService:
    @staticmethod
    def validate_overlapping_appointments(patient, date, start_time, duration_minutes):
        """
        Check if the proposed appointment overlaps with any existing active appointments for the patient.
        """
        active_statuses = [
            Appointment.Status.PENDING,
            Appointment.Status.CONFIRMED,
        ]
        
        start_dt = timezone.make_aware(datetime.datetime.combine(date, start_time))
        end_dt = start_dt + datetime.timedelta(minutes=duration_minutes)
        
        existing_appointments = Appointment.objects.filter(
            patient=patient,
            appointment_date=date,
            status__in=active_statuses
        ).select_related('service')
        
        for appt in existing_appointments:
            appt_start = timezone.make_aware(datetime.datetime.combine(appt.appointment_date, appt.appointment_time))
            appt_end = appt_start + datetime.timedelta(minutes=appt.service.duration_minutes)
            
            if start_dt < appt_end and end_dt > appt_start:
                raise OverlappingAppointmentError("You have an overlapping appointment.")

    @staticmethod
    def validate_duplicate_booking(patient, service, date):
        """
        Check if the patient already has an active appointment for the exact same service on the same day.
        """
        active_statuses = [
            Appointment.Status.PENDING,
            Appointment.Status.CONFIRMED,
        ]
        
        has_duplicate = Appointment.objects.filter(
            patient=patient,
            service=service,
            appointment_date=date,
            status__in=active_statuses
        ).exists()
        
        if has_duplicate:
            raise DuplicateAppointmentError("You already have an active appointment for this service.")

    @staticmethod
    def validate_booking_request(patient, doctor, service, date, time):
        """
        Main orchestrator for booking validation.
        """
        PatientAppointmentValidationService.validate_duplicate_booking(patient, service, date)
        PatientAppointmentValidationService.validate_overlapping_appointments(patient, date, time, service.duration_minutes)
