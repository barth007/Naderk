import datetime
from django.utils import timezone
from django.db import transaction
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from naderk.common.responses.builders import build_success_response, build_error_response
from .models import MedicalService, Appointment, AppointmentSlotReservation
from .serializers import (
    MedicalServiceSerializer,
    AppointmentSerializer,
    AssignSpecialistRequestSerializer,
    AvailableSlotsRequestSerializer,
    ReserveSlotRequestSerializer,
    CreateAppointmentRequestSerializer,
    DoctorProfileSerializer
)
from .services import (
    ConsultationService,
    DoctorAssignmentService,
    AppointmentSlotService,
    PatientAppointmentValidationService,
    DuplicateAppointmentError,
    OverlappingAppointmentError,
)
from naderk.core.models import User

class MedicalServiceListApi(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        services = MedicalService.objects.filter(is_active=True)
        serializer = MedicalServiceSerializer(services, many=True)
        return build_success_response("Services retrieved successfully", {"results": serializer.data})

class AssignSpecialistApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = AssignSpecialistRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response("validation-error", "Invalid Data", 400, "Validation failed", errors=serializer.errors)
            
        service_id = serializer.validated_data['service_id']
        requested_date = serializer.validated_data['date']
        
        try:
            service = MedicalService.objects.get(id=service_id, is_active=True)
        except MedicalService.DoesNotExist:
            return build_error_response("not-found", "Service not found", 404, "Invalid service ID")
            
        best_doctor = DoctorAssignmentService.assign_best_doctor(service.required_specialization, requested_date)
        
        if not best_doctor:
            return build_error_response("unavailable", "No specialists available", 404, "No available specialists found for this date.")
            
        fee = ConsultationService.calculate_fee(request.user, service)
        is_valid = ConsultationService.has_active_plan(request.user, service)
        
        doctor_data = DoctorProfileSerializer(best_doctor.doctor_profile).data
        
        return build_success_response("Specialist assigned", {
            "doctor": doctor_data,
            "consultation_fee": fee,
            "consultation_valid": is_valid,
            "estimated_wait_time": "15-20 mins" # Placeholder based on load
        })

class AvailableSlotsApi(APIView):
    permission_classes = [AllowAny] # Can allow any so users can browse slots before logging in
    
    def get(self, request):
        serializer = AvailableSlotsRequestSerializer(data=request.query_params)
        if not serializer.is_valid():
            return build_error_response("validation-error", "Invalid parameters", 400, "Validation failed", errors=serializer.errors)
            
        doctor_id = serializer.validated_data['doctor_id']
        date = serializer.validated_data['date']
        
        try:
            doctor = User.objects.get(id=doctor_id, role=User.Role.DOCTOR)
        except User.DoesNotExist:
            return build_error_response("not-found", "Doctor not found", 404, "Invalid doctor ID")
            
        slots = AppointmentSlotService.generate_available_slots(doctor, date)
        
        return build_success_response("Slots retrieved", {"slots": slots})

class ReserveSlotApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = ReserveSlotRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response("validation-error", "Invalid Data", 400, "Validation failed", errors=serializer.errors)
            
        doctor_id = serializer.validated_data['doctor_id']
        date = serializer.validated_data['date']
        time = serializer.validated_data['time']
        
        try:
            doctor = User.objects.get(id=doctor_id)
        except User.DoesNotExist:
            return build_error_response("not-found", "Doctor not found", 404, "Invalid doctor ID")
            
        slot_datetime = datetime.datetime.combine(date, time)
        slot_datetime = timezone.make_aware(slot_datetime)
        
        if slot_datetime < timezone.now():
            return build_error_response("invalid-time", "Invalid Time", 400, "Cannot reserve a slot in the past")
            
        # Check if already booked
        if Appointment.objects.filter(doctor=doctor, appointment_date=date, appointment_time=time, status__in=[Appointment.Status.CONFIRMED, Appointment.Status.PENDING]).exists():
            return build_error_response("conflict", "Slot unavailable", 409, "This slot is already booked")
            
        # Check if already reserved by someone else
        active_reservations = AppointmentSlotReservation.objects.filter(
            doctor=doctor,
            slot_datetime=slot_datetime,
            status=AppointmentSlotReservation.Status.RESERVED,
            expires_at__gt=timezone.now()
        ).exclude(patient=request.user)
        
        if active_reservations.exists():
            return build_error_response("conflict", "Slot reserved", 409, "This slot is currently reserved by another user")
            
        # Create or update reservation for THIS user
        reservation, created = AppointmentSlotReservation.objects.update_or_create(
            patient=request.user,
            doctor=doctor,
            slot_datetime=slot_datetime,
            defaults={
                'expires_at': timezone.now() + datetime.timedelta(minutes=10),
                'status': AppointmentSlotReservation.Status.RESERVED
            }
        )
        
        return build_success_response("Slot reserved", {
            "reservation_id": reservation.id,
            "expires_at": reservation.expires_at
        })

class CreateAppointmentApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        serializer = CreateAppointmentRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response("validation-error", "Invalid Data", 400, "Validation failed", errors=serializer.errors)
            
        service_id = serializer.validated_data['service_id']
        doctor_id = serializer.validated_data['doctor_id']
        date = serializer.validated_data['date']
        time = serializer.validated_data['time']
        
        try:
            service = MedicalService.objects.get(id=service_id)
            doctor = User.objects.get(id=doctor_id)
        except (MedicalService.DoesNotExist, User.DoesNotExist):
            return build_error_response("not-found", "Resource not found", 404, "Invalid service or doctor ID")
            
        slot_datetime = timezone.make_aware(datetime.datetime.combine(date, time))
        
        # Idempotency: if the patient already has a PENDING (unpaid) appointment
        # for exactly this service+doctor+date+time, return it so they can retry payment.
        existing_pending = Appointment.objects.filter(
            patient=request.user,
            doctor=doctor,
            service=service,
            appointment_date=date,
            appointment_time=time,
            status=Appointment.Status.PENDING,
            payment_status=Appointment.PaymentStatus.PENDING,
        ).first()
        if existing_pending:
            return build_success_response(
                "Appointment already exists — retrying payment",
                AppointmentSerializer(existing_pending).data,
            )

        try:
            PatientAppointmentValidationService.validate_booking_request(
                patient=request.user,
                doctor=doctor,
                service=service,
                date=date,
                time=time
            )
        except DuplicateAppointmentError as e:
            from rest_framework.response import Response
            return Response({
                "type": "https://api.naderkeye.com/problems/duplicate-booking",
                "title": "Duplicate appointment",
                "status": 409,
                "detail": str(e),
                "instance": "/api/v1/appointments/create"
            }, status=409)
        except OverlappingAppointmentError as e:
            from rest_framework.response import Response
            return Response({
                "type": "https://api.naderkeye.com/problems/overlapping-booking",
                "title": "Overlapping appointment",
                "status": 409,
                "detail": str(e),
                "instance": "/api/v1/appointments/create"
            }, status=409)
        
        with transaction.atomic():
            # Verify reservation (optional but good for strict locking)
            reservation = AppointmentSlotReservation.objects.select_for_update().filter(
                patient=request.user,
                doctor=doctor,
                slot_datetime=slot_datetime,
                status=AppointmentSlotReservation.Status.RESERVED,
                expires_at__gt=timezone.now()
            ).first()
            
            if not reservation:
                # Check if it's available anyway before allowing booking
                if Appointment.objects.filter(doctor=doctor, appointment_date=date, appointment_time=time, status__in=[Appointment.Status.CONFIRMED, Appointment.Status.PENDING]).exists():
                     return build_error_response("conflict", "Slot unavailable", 409, "This slot is already booked")
                     
                active_res = AppointmentSlotReservation.objects.select_for_update().filter(
                    doctor=doctor,
                    slot_datetime=slot_datetime,
                    status=AppointmentSlotReservation.Status.RESERVED,
                    expires_at__gt=timezone.now()
                )
                if active_res.exists():
                    return build_error_response("conflict", "Slot reserved", 409, "This slot is currently reserved by another user")
    
            fee = ConsultationService.calculate_fee(request.user, service)
            
            # Mock telehealth link
            appointment_type = serializer.validated_data['appointment_type']
            meeting_link = None
            if appointment_type == Appointment.AppointmentType.TELEHEALTH:
                import uuid as py_uuid
                meeting_link = f"/dashboard/telehealth/{py_uuid.uuid4()}"

                
            appointment = Appointment.objects.create(
                patient=request.user,
                doctor=doctor,
                service=service,
                appointment_date=date,
                appointment_time=time,
                appointment_type=appointment_type,
                status=Appointment.Status.PENDING,
                consultation_fee=fee,
                payment_status=Appointment.PaymentStatus.PENDING,
                notes=serializer.validated_data.get('notes', ''),
                meeting_link=meeting_link
            )
            
            if reservation:
                reservation.status = AppointmentSlotReservation.Status.BOOKED
                reservation.save()
                
        return build_success_response("Appointment booked successfully", AppointmentSerializer(appointment).data)

class AppointmentHistoryApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Sync check as a fail-safe for local development if celery beat is not running
        try:
            from .tasks import mark_missed_appointments
            mark_missed_appointments()
        except Exception:
            pass

        active_statuses = [
            Appointment.Status.PENDING, 
            Appointment.Status.CONFIRMED, 
            Appointment.Status.CHECKED_IN, 
            Appointment.Status.IN_PROGRESS
        ]
        
        patient = request.user
        patient_id = request.query_params.get('patient_id')
        if patient_id and request.user.role in ['AGENT', 'DOCTOR', 'ADMIN']:
            from naderk.core.models import User
            try:
                patient = User.objects.get(id=patient_id, role=User.Role.PATIENT)
            except User.DoesNotExist:
                pass

        upcoming = Appointment.objects.filter(
            patient=patient,
            status__in=active_statuses
        ).order_by('appointment_date', 'appointment_time')
        
        past = Appointment.objects.filter(
            patient=patient
        ).exclude(
            status__in=active_statuses
        ).order_by('-appointment_date', '-appointment_time')
        
        return build_success_response("History retrieved", {
            "upcoming": AppointmentSerializer(upcoming, many=True).data,
            "past": AppointmentSerializer(past, many=True).data
        })

class CancelAppointmentApi(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        is_admin = request.user.role in ('ADMIN', 'SUPER_ADMIN', 'DOCTOR')
        try:
            if is_admin:
                appointment = Appointment.objects.get(id=pk)
            else:
                appointment = Appointment.objects.get(id=pk, patient=request.user)
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")

        if appointment.status in [Appointment.Status.CANCELLED, Appointment.Status.COMPLETED, Appointment.Status.NO_SHOW]:
            return build_error_response("invalid-state", "Cannot cancel", 400, "Appointment is already completed or cancelled")

        appointment.status = Appointment.Status.CANCELLED
        appointment.cancelled_at = timezone.now()
        appointment.cancellation_reason = request.data.get('reason', '')
        appointment.save()

        return build_success_response("Appointment cancelled successfully", AppointmentSerializer(appointment).data)

class RescheduleAppointmentApi(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from .serializers import RescheduleAppointmentRequestSerializer
        serializer = RescheduleAppointmentRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return build_error_response("validation-error", "Invalid Data", 400, "Validation failed", errors=serializer.errors)

        is_admin = request.user.role in ('ADMIN', 'SUPER_ADMIN', 'DOCTOR')
        try:
            if is_admin:
                appointment = Appointment.objects.get(id=pk)
            else:
                appointment = Appointment.objects.get(id=pk, patient=request.user)
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")
            
        if appointment.status in [Appointment.Status.CANCELLED, Appointment.Status.COMPLETED, Appointment.Status.NO_SHOW]:
            return build_error_response("invalid-state", "Cannot reschedule", 400, "Appointment is already completed or cancelled")
            
        new_date = serializer.validated_data['date']
        new_time = serializer.validated_data['time']
        
        slot_datetime = timezone.make_aware(datetime.datetime.combine(new_date, new_time))
        if slot_datetime < timezone.now():
            return build_error_response("invalid-time", "Invalid Time", 400, "Cannot reschedule to a past time")
            
        try:
            PatientAppointmentValidationService.validate_overlapping_appointments(
                patient=request.user,
                date=new_date,
                start_time=new_time,
                duration_minutes=appointment.service.duration_minutes
            )
        except OverlappingAppointmentError as e:
            from rest_framework.response import Response
            return Response({
                "type": "https://api.naderkeye.com/problems/overlapping-booking",
                "title": "Overlapping appointment",
                "status": 409,
                "detail": str(e),
                "instance": f"/api/v1/appointments/{pk}/reschedule"
            }, status=409)
            
        with transaction.atomic():
            # Check slot availability
            if Appointment.objects.exclude(id=pk).filter(doctor=appointment.doctor, appointment_date=new_date, appointment_time=new_time, status__in=[Appointment.Status.CONFIRMED, Appointment.Status.PENDING]).exists():
                 return build_error_response("conflict", "Slot unavailable", 409, "This slot is already booked")
                 
            appointment.appointment_date = new_date
            appointment.appointment_time = new_time
            appointment.save()
            
        return build_success_response("Appointment rescheduled successfully", AppointmentSerializer(appointment).data)

class AppointmentDetailApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            appointment = Appointment.objects.select_related('service', 'doctor').get(
                id=pk, patient=request.user
            )
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")
        return build_success_response("Appointment retrieved", AppointmentSerializer(appointment).data)

    def delete(self, request, pk):
        try:
            appointment = Appointment.objects.get(id=pk, patient=request.user)
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")

        appointment.delete()
        return build_success_response("Appointment deleted successfully", None)

class CheckInAppointmentApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            appointment = Appointment.objects.get(id=pk, patient=request.user)
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")
            
        if appointment.status != Appointment.Status.CONFIRMED:
            return build_error_response("invalid-state", "Cannot check-in", 400, "Appointment is not confirmed")
            
        appointment.status = Appointment.Status.CHECKED_IN
        appointment.checked_in_at = timezone.now()
        appointment.save()
        
        return build_success_response("Checked in successfully", AppointmentSerializer(appointment).data)

class StartAppointmentApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            appointment = Appointment.objects.get(id=pk)
            if request.user not in [appointment.patient, appointment.doctor]:
                return build_error_response("forbidden", "Access denied", 403, "Not your appointment")
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")
            
        if appointment.status not in [Appointment.Status.CONFIRMED, Appointment.Status.CHECKED_IN]:
            return build_error_response("invalid-state", "Cannot start", 400, "Appointment is not ready to start")
            
        appointment.status = Appointment.Status.IN_PROGRESS
        appointment.started_at = timezone.now()
        appointment.save()
        
        return build_success_response("Appointment started", AppointmentSerializer(appointment).data)

class CompleteAppointmentApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            appointment = Appointment.objects.get(id=pk)
            if request.user not in [appointment.patient, appointment.doctor]:
                return build_error_response("forbidden", "Access denied", 403, "Not your appointment")
        except Appointment.DoesNotExist:
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")
            
        if appointment.status not in [Appointment.Status.IN_PROGRESS, Appointment.Status.CHECKED_IN, Appointment.Status.CONFIRMED]:
            return build_error_response("invalid-state", "Cannot complete", 400, "Appointment cannot be completed from current state")
            
        appointment.status = Appointment.Status.COMPLETED
        appointment.completed_at = timezone.now()
        appointment.save()
        
        return build_success_response("Appointment completed", AppointmentSerializer(appointment).data)
