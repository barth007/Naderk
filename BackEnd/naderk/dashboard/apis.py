from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from naderk.common.responses.builders import build_success_response
from naderk.appointments.models import Appointment
from naderk.users.models import DoctorNote
from naderk.messaging.models import Conversation, ConversationStatus
from naderk.messaging.selectors import get_unread_message_count
from naderk.telehealth.models import TelehealthSession

class DoctorSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user
        today = timezone.now().date()
        
        total_appointments = Appointment.objects.filter(doctor=doctor).count()
        appointments_today = Appointment.objects.filter(doctor=doctor, appointment_date=today).count()
        new_appointments = Appointment.objects.filter(doctor=doctor, status=Appointment.Status.PENDING).count()
        cancelled_appointments = Appointment.objects.filter(doctor=doctor, status=Appointment.Status.CANCELLED).count()
        
        # Messaging metrics
        active_conversations_count = Conversation.objects.filter(
            assigned_doctor=doctor
        ).exclude(status=ConversationStatus.CLOSED).count()
        
        unread_messages_count = get_unread_message_count(user=doctor)
        
        # Telehealth metrics
        upcoming_sessions_count = TelehealthSession.objects.filter(
            doctor=doctor,
            status__in=[
                TelehealthSession.Status.SCHEDULED,
                TelehealthSession.Status.WAITING_ROOM,
                TelehealthSession.Status.WAITING_FOR_DOCTOR
            ]
        ).count()
        
        active_sessions_count = TelehealthSession.objects.filter(
            doctor=doctor,
            status=TelehealthSession.Status.ACTIVE
        ).count()
        
        missed_sessions_count = TelehealthSession.objects.filter(
            doctor=doctor,
            status=TelehealthSession.Status.MISSED
        ).count()
        
        data = {
            "total_appointments": total_appointments,
            "appointments_today": appointments_today,
            "new_appointments": new_appointments,
            "cancelled_appointments": cancelled_appointments,
            "active_conversations": active_conversations_count,
            "unread_messages": unread_messages_count,
            "upcoming_sessions": upcoming_sessions_count,
            "active_sessions": active_sessions_count,
            "missed_sessions": missed_sessions_count
        }
        return build_success_response(message="Summary retrieved successfully.", data=data, status_code=200)

class DoctorCalendarAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user
        appointments = Appointment.objects.filter(
            doctor=doctor
        ).exclude(status=Appointment.Status.CANCELLED).order_by('appointment_date', 'appointment_time')[:100]
        
        results = []
        for appt in appointments:
            results.append({
                "id": str(appt.id),
                "title": f"{appt.patient.first_name} {appt.patient.last_name} ({appt.service.name})",
                "date": appt.appointment_date.isoformat(),
                "time": appt.appointment_time.isoformat(),
                "type": appt.appointment_type,
                "status": appt.status
            })
        return build_success_response(message="Calendar retrieved successfully.", data=results, status_code=200)

class DoctorAppointmentsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user
        today = timezone.now().date()
        appointments = Appointment.objects.filter(
            doctor=doctor,
            appointment_date=today
        ).exclude(status__in=[Appointment.Status.CANCELLED, Appointment.Status.PENDING]).order_by('appointment_time')
        
        results = []
        for appt in appointments:
            results.append({
                "id": str(appt.id),
                "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}".strip() or appt.patient.email,
                "patient_avatar": getattr(appt.patient, 'profile_picture', None),
                "consultation_type": appt.service.name,
                "severity": "High" if appt.appointment_type == Appointment.AppointmentType.EMERGENCY else "Normal",
                "time": appt.appointment_time.isoformat(),
                "telehealth": appt.appointment_type == Appointment.AppointmentType.TELEHEALTH,
                "status": appt.status
            })
        return build_success_response(message="Today's appointments retrieved.", data=results, status_code=200)

class DoctorRequestsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user
        pending_requests = Appointment.objects.filter(
            doctor=doctor,
            status=Appointment.Status.PENDING,
        ).exclude(
            # Hide appointments awaiting payment — only surface to doctor once paid (or free).
            payment_status=Appointment.PaymentStatus.PENDING,
            consultation_fee__gt=0,
        ).order_by('appointment_date', 'appointment_time')
        
        results = []
        for appt in pending_requests:
            results.append({
                "id": str(appt.id),
                "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}".strip() or appt.patient.email,
                "patient_avatar": getattr(appt.patient, 'profile_picture', None),
                "service_name": appt.service.name,
                "date": appt.appointment_date.isoformat(),
                "time": appt.appointment_time.isoformat(),
                "type": appt.appointment_type
            })
        return build_success_response(message="Pending requests retrieved.", data=results, status_code=200)

class DoctorAcceptRequestAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        import datetime
        from naderk.telehealth.models import TelehealthSession
        from naderk.messaging.models import Conversation
        try:
            appt = Appointment.objects.get(id=pk, doctor=request.user, status=Appointment.Status.PENDING)
            appt.status = Appointment.Status.CONFIRMED
            appt.save()

            if appt.appointment_type == Appointment.AppointmentType.TELEHEALTH:
                appointment_datetime = timezone.make_aware(
                    datetime.datetime.combine(appt.appointment_date, appt.appointment_time)
                )
                from naderk.messaging.models import ConversationParticipant, ParticipantRole
                conversation = Conversation.objects.filter(related_appointment=appt).first()
                TelehealthSession.objects.get_or_create(
                    appointment=appt,
                    defaults={
                        'room_name': f"room-{appt.id}",
                        'scheduled_start': appointment_datetime,
                        'scheduled_end': appointment_datetime + datetime.timedelta(minutes=30),
                        'conversation': conversation,
                        'status': TelehealthSession.Status.SCHEDULED,
                        'recording_enabled': False,
                    }
                )
                # Ensure doctor is a ConversationParticipant so they receive
                # real-time conversation_update broadcasts when the patient sends a message.
                if conversation:
                    ConversationParticipant.objects.get_or_create(
                        conversation=conversation,
                        user=request.user,
                        defaults={'role': ParticipantRole.DOCTOR},
                    )

            return build_success_response(message="Appointment request accepted.", data={"id": str(appt.id)}, status_code=200)
        except Appointment.DoesNotExist:
            return build_success_response(message="Appointment not found or not pending.", status_code=404, success=False)

class DoctorRejectRequestAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            appt = Appointment.objects.get(id=pk, doctor=request.user, status=Appointment.Status.PENDING)
            appt.status = Appointment.Status.CANCELLED
            appt.cancellation_reason = request.data.get("reason", "Rejected by doctor")
            appt.save()
            return build_success_response(message="Appointment request rejected.", data={"id": str(appt.id)}, status_code=200)
        except Appointment.DoesNotExist:
            return build_success_response(message="Appointment not found or not pending.", status_code=404, success=False)

class DoctorTelehealthAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user
        today = timezone.now().date()
        sessions = Appointment.objects.filter(
            doctor=doctor, 
            appointment_date=today,
            appointment_type=Appointment.AppointmentType.TELEHEALTH
        ).exclude(status=Appointment.Status.CANCELLED)
        
        results = []
        for s in sessions:
            results.append({
                "id": str(s.id),
                "patient_name": f"{s.patient.first_name} {s.patient.last_name}".strip() or s.patient.email,
                "time": s.appointment_time.isoformat(),
                "status": s.status,
                "meeting_link": s.meeting_link or f"https://meet.livekit.io/naderk-{s.id}"
            })
        return build_success_response(message="Telehealth sessions retrieved.", data=results, status_code=200)

class DoctorScratchpadAPI(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        doctor = request.user
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        active_note = DoctorNote.objects.filter(
            doctor=doctor, 
            note_type='TEMPORARY',
            updated_at__gte=thirty_days_ago
        ).order_by('-updated_at').first()
        
        content = active_note.content if active_note else ""
        return build_success_response(
            message="Scratchpad note retrieved.",
            data={
                "content": content,
                "note_type": "TEMPORARY",
                "created_at": active_note.created_at.isoformat() if active_note else None,
                "updated_at": active_note.updated_at.isoformat() if active_note else None,
            },
            status_code=200
        )
        
    def post(self, request):
        doctor = request.user
        content = request.data.get("content", "")
        note_type = request.data.get("note_type", "TEMPORARY")
        
        note = DoctorNote.objects.create(
            doctor=doctor,
            content=content,
            note_type=note_type
        )
        
        return build_success_response(
            message="Scratchpad note saved successfully.",
            data={
                "id": str(note.id),
                "content": note.content,
                "note_type": note.note_type,
                "updated_at": note.updated_at.isoformat()
            },
            status_code=201
        )
