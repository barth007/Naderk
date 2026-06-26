from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from naderk.common.responses.builders import build_success_response, build_error_response
from naderk.telehealth.models import TelehealthSession
from naderk.telehealth.serializers import TelehealthSessionSerializer
from naderk.telehealth.selectors import get_user_sessions
from naderk.telehealth.services.generate_token import generate_livekit_token
from naderk.telehealth.services.session_lifecycle import join_session, end_session
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError
import datetime

class SessionListApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        sessions = get_user_sessions(user=request.user)
        data = {
            'active': TelehealthSessionSerializer(sessions['active'], many=True).data,
            'upcoming': TelehealthSessionSerializer(sessions['upcoming'], many=True).data,
            'past': TelehealthSessionSerializer(sessions['past'], many=True).data,
        }
        return build_success_response("Sessions retrieved successfully", data)

class SessionDetailApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        try:
            session = TelehealthSession.objects.get(id=pk)
        except TelehealthSession.DoesNotExist:
            return build_error_response("not-found", "Session not found", 404, "Invalid session ID")
            
        # Access control
        appointment = session.appointment
        if request.user.id not in [appointment.patient.id, appointment.doctor.id] and request.user.role not in ['AGENT', 'MEDICAL_AGENT', 'ADMIN']:
            return build_error_response("forbidden", "Access Denied", 403, "You are not authorized to view this session")
            
        return build_success_response("Session detail retrieved", TelehealthSessionSerializer(session).data)

class SessionCreateApi(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        appointment_id = request.data.get('appointment_id')
        if not appointment_id:
            return build_error_response("bad-request", "Appointment ID required", 400, "appointment_id is required")
            
        from naderk.appointments.models import Appointment
        try:
            appointment = Appointment.objects.get(id=appointment_id)
        except (Appointment.DoesNotExist, ValidationError):
            return build_error_response("not-found", "Appointment not found", 404, "Invalid appointment ID")
            
        # Assert appointment type is TELEHEALTH, status is CONFIRMED.
        if appointment.appointment_type != Appointment.AppointmentType.TELEHEALTH:
            return build_error_response("bad-request", "Invalid appointment type", 400, "Only telehealth appointments can have sessions.")
            
        if appointment.status != Appointment.Status.CONFIRMED:
            return build_error_response("bad-request", "Invalid appointment status", 400, "Only confirmed appointments can have sessions.")
            
        from django.utils.timezone import make_aware
        appointment_datetime = make_aware(datetime.datetime.combine(appointment.appointment_date, appointment.appointment_time))

        # Check if telehealth session already exists
        if hasattr(appointment, 'telehealth_session'):
            session = appointment.telehealth_session
            return build_success_response("Session already exists", TelehealthSessionSerializer(session).data)
            
        # Instantiate TelehealthSession & participants
        room_name = f"room-{appointment.id}"
        scheduled_end = appointment_datetime + timezone.timedelta(minutes=30)
        
        # Get or create conversation if it doesn't exist
        from naderk.messaging.models import Conversation
        conversation = Conversation.objects.filter(related_appointment=appointment).first()
        
        session = TelehealthSession.objects.create(
            appointment=appointment,
            room_name=room_name,
            scheduled_start=appointment_datetime,
            scheduled_end=scheduled_end,
            conversation=conversation,
            status=TelehealthSession.Status.SCHEDULED,
            recording_enabled=False
        )
        
        return build_success_response("Session created successfully", TelehealthSessionSerializer(session).data, 201)

class JoinSessionApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk=None):
        session_id = pk or request.data.get('session_id')
        if not session_id:
            return build_error_response("bad-request", "Session ID required", 400, "session_id is a required field")
            
        try:
            session = TelehealthSession.objects.get(id=session_id)
        except (TelehealthSession.DoesNotExist, ValidationError):
            return build_error_response("not-found", "Session not found", 404, "Invalid session ID")
            
        # Access control
        appointment = session.appointment
        if request.user.id not in [appointment.patient.id, appointment.doctor.id]:
            return build_error_response("forbidden", "Access Denied", 403, "You are not authorized to join this session")
            
        try:
            # Generate LiveKit Token
            token = generate_livekit_token(session=session, user=request.user)
        except PermissionError as e:
            return build_error_response("forbidden", "Access Denied", 403, str(e))
            
        # Call lifecycle service
        join_session(session=session, user=request.user)
        
        # Get server URL
        server_url = getattr(settings, 'LIVEKIT_URL', 'http://localhost:7880')
        if server_url.startswith('http://'):
            server_url = server_url.replace('http://', 'ws://', 1)
        elif server_url.startswith('https://'):
            server_url = server_url.replace('https://', 'wss://', 1)
            
        data = {
            'room_name': session.room_name,
            'token': token,
            'server_url': server_url
        }
        return build_success_response("Successfully joined session", data)

class SessionCompleteApi(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk):
        try:
            session = TelehealthSession.objects.get(id=pk)
        except TelehealthSession.DoesNotExist:
            return build_error_response("not-found", "Session not found", 404, "Invalid session ID")
            
        session_notes = request.data.get('session_notes', '')
        diagnosis = request.data.get('diagnosis', '')
        recommendations = request.data.get('recommendations', '')
        follow_up_date = request.data.get('follow_up_date', None)

        if session_notes:
            session.session_notes = session_notes
            session.save(update_fields=['session_notes'])

        try:
            end_session(session=session, user=request.user)
        except PermissionError as e:
            return build_error_response("forbidden", "Access Denied", 403, str(e))
            
        # Retrieve the generated ConsultationEncounter and populate extra fields
        from naderk.medical_records.models import ConsultationEncounter
        encounter = ConsultationEncounter.objects.filter(telehealth_session=session).first()
        if encounter:
            if diagnosis:
                encounter.diagnosis = diagnosis
            if recommendations:
                encounter.recommendations = recommendations
            if follow_up_date:
                try:
                    encounter.follow_up_date = follow_up_date
                except Exception:
                    pass
            encounter.save()

        return build_success_response("Session completed successfully", TelehealthSessionSerializer(session).data)
