import logging

from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count, Q, F
from django.db.models.functions import TruncMonth, TruncDate
from naderk.common.responses.builders import build_success_response, build_error_response
from naderk.appointments.models import Appointment
from naderk.users.models import DoctorNote
from naderk.messaging.models import Conversation, ConversationStatus
from naderk.messaging.selectors import get_unread_message_count
from naderk.telehealth.models import TelehealthSession
from naderk.ecommerce.models import Order, Prescription
from datetime import timedelta, date

logger = logging.getLogger(__name__)

class DoctorSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor = request.user
        today = timezone.now().date()
        
        # These were the last counters still bypassing exclude_unpaid_checkouts,
        # so an abandoned checkout showed as "1 appointment / 1 new request" on
        # the dashboard while DoctorRequestsAPI — which does exclude them — had
        # nothing to list. The doctor could see the number but had nothing to
        # accept or reject.
        doctor_appts = Appointment.objects.filter(doctor=doctor).exclude_unpaid_checkouts()
        total_appointments = doctor_appts.count()
        appointments_today = doctor_appts.filter(appointment_date=today).count()
        new_appointments = doctor_appts.filter(status=Appointment.Status.PENDING).count()
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
        appointments = (
            Appointment.objects.filter(doctor=doctor)
            .exclude_unpaid_checkouts()
            .exclude(status=Appointment.Status.CANCELLED)
            .order_by('appointment_date', 'appointment_time')[:100]
        )
        
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
        # PENDING is kept here on purpose. It used to be excluded, so a paid
        # appointment awaiting the doctor's acceptance showed on the calendar
        # for today while this queue said "no patients waiting" — two widgets on
        # one screen contradicting each other about the same booking. Unpaid
        # rows are still filtered out, so only real bookings appear.
        appointments = (
            Appointment.objects.filter(doctor=doctor, appointment_date=today)
            .exclude_unpaid_checkouts()
            .exclude(status=Appointment.Status.CANCELLED)
            .order_by('appointment_time')
        )
        
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
        # Only surface a request to the doctor once it is paid (or free).
        pending_requests = (
            Appointment.objects.filter(doctor=doctor, status=Appointment.Status.PENDING)
            .exclude_unpaid_checkouts()
            .order_by('appointment_date', 'appointment_time')
        )
        
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
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Appointment not found or not pending.',
            )

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
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Appointment not found or not pending.',
            )

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


class AdminDashboardSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('ADMIN', 'SUPER_ADMIN'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        today = timezone.now().date()
        yesterday = today - timedelta(days=1)
        six_months_ago = today - timedelta(days=182)
        month_start = today.replace(day=1)

        # --- Stat: appointments today ---
        appts_today = Appointment.objects.filter(
            appointment_date=today
        ).exclude(status=Appointment.Status.CANCELLED).count()

        appts_yesterday = Appointment.objects.filter(
            appointment_date=yesterday
        ).exclude(status=Appointment.Status.CANCELLED).count()

        if appts_yesterday > 0:
            appts_change = round((appts_today - appts_yesterday) / appts_yesterday * 100)
        else:
            appts_change = 100 if appts_today > 0 else 0

        # --- Stat: active telehealth ---
        active_telehealth = TelehealthSession.objects.filter(
            status=TelehealthSession.Status.ACTIVE
        ).count()

        # --- Stat: pending prescriptions ---
        pending_prescriptions = Prescription.objects.filter(
            status__in=[Prescription.Status.PENDING_REVIEW, Prescription.Status.UNDER_REVIEW]
        ).count()

        # --- Stat: optical revenue today ---
        revenue_today = (
            Order.objects.filter(payment_status=Order.PaymentStatus.PAID, updated_at__date=today)
            .aggregate(total=Sum('total_price'))['total'] or 0
        )
        revenue_yesterday = (
            Order.objects.filter(payment_status=Order.PaymentStatus.PAID, updated_at__date=yesterday)
            .aggregate(total=Sum('total_price'))['total'] or 0
        )
        if revenue_yesterday > 0:
            revenue_change = round((float(revenue_today) - float(revenue_yesterday)) / float(revenue_yesterday) * 100)
        else:
            revenue_change = 100 if revenue_today > 0 else 0

        # --- Appointment queue: today's appointments (must match the summary count above,
        # which counts all non-cancelled appointments, including PENDING) ---
        queue_qs = (
            Appointment.objects.filter(appointment_date=today)
            .exclude_unpaid_checkouts()
            .exclude(status=Appointment.Status.CANCELLED)
            .order_by('appointment_time')
            .select_related('patient', 'service')[:20]
        )

        appointment_queue = []
        for appt in queue_qs:
            appointment_queue.append({
                "id": str(appt.id),
                "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}".strip() or appt.patient.email,
                "status": appt.status,
                "service": appt.service.name if appt.service else "—",
                "date": appt.appointment_date.isoformat(),
                "time": appt.appointment_time.isoformat(),
                "type": appt.appointment_type,
            })

        # --- Patient volume trends: last 6 months ---
        trends_qs = (
            Appointment.objects.filter(appointment_date__gte=six_months_ago)
            .annotate(month=TruncMonth('appointment_date'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )
        MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        patient_volume_trends = [
            {"month": MONTH_NAMES[row['month'].month - 1], "count": row['count']}
            for row in trends_qs
        ]

        # --- Revenue breakdown (current month, as percentages) ---
        medical_rev = (
            Appointment.objects.filter(
                appointment_date__gte=month_start,
                payment_status=Appointment.PaymentStatus.PAID,
                appointment_type=Appointment.AppointmentType.PHYSICAL
            ).aggregate(total=Sum('consultation_fee'))['total'] or 0
        )
        telehealth_rev = (
            Appointment.objects.filter(
                appointment_date__gte=month_start,
                payment_status=Appointment.PaymentStatus.PAID,
                appointment_type=Appointment.AppointmentType.TELEHEALTH
            ).aggregate(total=Sum('consultation_fee'))['total'] or 0
        )
        optical_rev = (
            Order.objects.filter(
                payment_status=Order.PaymentStatus.PAID,
                updated_at__date__gte=month_start
            ).aggregate(total=Sum('total_price'))['total'] or 0
        )
        total_rev = float(medical_rev) + float(telehealth_rev) + float(optical_rev)
        if total_rev > 0:
            revenue_breakdown = {
                "medical_services": round(float(medical_rev) / total_rev * 100),
                "optical_store": round(float(optical_rev) / total_rev * 100),
                "telehealth": round(float(telehealth_rev) / total_rev * 100),
            }
        else:
            revenue_breakdown = {"medical_services": 65, "optical_store": 25, "telehealth": 10}

        data = {
            "stats": {
                "appointments_today": appts_today,
                "appointments_today_change": appts_change,
                "active_telehealth": active_telehealth,
                "pending_prescriptions": pending_prescriptions,
                "optical_revenue_today": float(revenue_today),
                "optical_revenue_change": revenue_change,
            },
            "appointment_queue": appointment_queue,
            "patient_volume_trends": patient_volume_trends,
            "revenue_breakdown": revenue_breakdown,
        }
        return build_success_response(message="Admin dashboard summary retrieved.", data=data, status_code=200)


# ─── Admin Appointment APIs ────────────────────────────────────────────────────

def _admin_only(request, area=None):
    """
    True when the request must be blocked. ADMIN/SUPER_ADMIN are always
    allowed. When `area` is given, a non-admin holding that capability area
    is also allowed (see naderk.common.permissions); otherwise the endpoint
    stays admin-only.
    """
    if getattr(request.user, 'role', None) in ('ADMIN', 'SUPER_ADMIN'):
        return False
    if area is not None:
        from naderk.common.permissions import user_has_area
        if user_has_area(request.user, area):
            return False
    return True


class AdminAppointmentRequestsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'appointments'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        qs = (
            Appointment.objects.filter(status=Appointment.Status.PENDING)
            .exclude_unpaid_checkouts()
            .order_by('-created_at')
            .select_related('patient', 'doctor', 'service')[:50]
        )

        results = []
        for appt in qs:
            # Build human-readable preference string from date + time + notes
            pref_parts = []
            if appt.appointment_date:
                pref_parts.append(appt.appointment_date.strftime('%B %-d'))
            if appt.appointment_time:
                h = appt.appointment_time.hour
                period = 'Morning' if h < 12 else ('Afternoon' if h < 17 else 'Evening')
                pref_parts.append(period)
            preference = f"{' '.join(pref_parts)} Preference" if pref_parts else (appt.notes or '—')

            results.append({
                "id": str(appt.id),
                "patient_name": f"{appt.patient.first_name} {appt.patient.last_name}".strip() or appt.patient.email,
                "patient_avatar": getattr(appt.patient, 'profile_picture', None),
                "service_name": appt.service.name if appt.service else "—",
                "appointment_type": appt.appointment_type,
                "is_emergency": appt.appointment_type == Appointment.AppointmentType.EMERGENCY,
                "preference": preference,
                "notes": appt.notes or "",
                "appointment_date": appt.appointment_date.isoformat() if appt.appointment_date else None,
                "appointment_time": appt.appointment_time.isoformat() if appt.appointment_time else None,
                "created_at": appt.created_at.isoformat(),
                "doctor_id": str(appt.doctor.id) if appt.doctor else None,
                "doctor_name": f"Dr. {appt.doctor.last_name}" if appt.doctor else None,
            })

        return build_success_response(message="Pending appointment requests retrieved.", data=results, status_code=200)


class AdminAppointmentCalendarAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'appointments'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        qs = (
            Appointment.objects.exclude(status=Appointment.Status.CANCELLED)
            .order_by('appointment_date', 'appointment_time')
            .select_related('patient', 'service')[:500]
        )

        results = []
        for appt in qs:
            results.append({
                "id": str(appt.id),
                "title": f"{appt.patient.first_name} {appt.patient.last_name}".strip() + (f" ({appt.service.name})" if appt.service else ""),
                "date": appt.appointment_date.isoformat() if appt.appointment_date else None,
                "time": appt.appointment_time.isoformat() if appt.appointment_time else None,
                "type": appt.appointment_type,
                "status": appt.status,
            })

        return build_success_response(message="Appointment calendar retrieved.", data=results, status_code=200)


class AdminScheduleAppointmentAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if _admin_only(request, 'appointments'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        import datetime as dt
        from naderk.core.models import User as UserModel

        try:
            appt = Appointment.objects.select_related('patient').get(id=pk, status=Appointment.Status.PENDING)
        except Appointment.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Appointment not found or not pending.',
            )

        doctor_id = request.data.get('doctor_id')
        new_date = request.data.get('date')
        new_time = request.data.get('time')

        if not all([doctor_id, new_date, new_time]):
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='doctor_id, date and time are required.',
            )

        try:
            doctor = UserModel.objects.get(id=doctor_id, role='DOCTOR')
        except UserModel.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Doctor not found.',
            )

        appt.doctor = doctor
        appt.appointment_date = new_date
        appt.appointment_time = new_time
        appt.status = Appointment.Status.CONFIRMED
        appt.save()

        # Create telehealth session if needed
        if appt.appointment_type == Appointment.AppointmentType.TELEHEALTH:
            from naderk.telehealth.models import TelehealthSession
            from naderk.messaging.models import Conversation
            appt_dt = timezone.make_aware(dt.datetime.combine(appt.appointment_date, appt.appointment_time))
            conversation = Conversation.objects.filter(related_appointment=appt).first()
            TelehealthSession.objects.get_or_create(
                appointment=appt,
                defaults={
                    'room_name': f"room-{appt.id}",
                    'doctor': doctor,
                    'patient': appt.patient,
                    'scheduled_start': appt_dt,
                    'scheduled_end': appt_dt + timedelta(minutes=30),
                    'conversation': conversation,
                    'status': TelehealthSession.Status.SCHEDULED,
                    'recording_enabled': False,
                }
            )

        return build_success_response(
            message="Appointment scheduled successfully.",
            data={"id": str(appt.id), "status": appt.status},
            status_code=200
        )


class AdminDoctorListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'appointments'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.users.models import DoctorProfile
        profiles = (
            DoctorProfile.objects.filter(is_accepting_patients=True)
            .select_related('user')
            .order_by('user__last_name')
        )
        results = [
            {
                "id": str(p.user.id),
                "name": f"Dr. {p.user.first_name} {p.user.last_name}".strip(),
                "specialization": p.specialization_display,
            }
            for p in profiles
        ]
        return build_success_response(message="Doctors retrieved.", data=results, status_code=200)


# ─── Admin Inventory APIs ──────────────────────────────────────────────────────

class AdminInventorySummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.ecommerce.models import Product
        products = Product.objects.filter(is_active=True).select_related('category')

        total_stock = products.aggregate(t=Sum('quantity_available'))['t'] or 0
        category_count = products.values('category').distinct().count()

        by_category = list(
            products.values('category__name')
            .annotate(total=Sum('quantity_available'))
            .order_by('-total')
        )

        # Compare against each product's own threshold rather than a hardcoded
        # 15. The old [:10] cap also meant a newly-low product only appeared if
        # it was among the ten lowest in the catalogue — which is why an alert
        # could refuse to show no matter how many times the page was refreshed.
        low_stock = list(
            products.filter(quantity_available__lte=F('low_stock_threshold'))
            .order_by('quantity_available')
            .values('id', 'name', 'quantity_available', 'low_stock_threshold', 'category__name')[:50]
        )
        for item in low_stock:
            item['id'] = str(item['id'])

        return build_success_response(
            message="Inventory summary retrieved.",
            data={
                'total_stock': total_stock,
                'category_count': category_count,
                'by_category': by_category,
                'low_stock_alerts': low_stock,
            },
            status_code=200
        )


class AdminProductsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.ecommerce.models import Product, OrderItem

        today = timezone.now().date()
        seven_days_ago = today - timedelta(days=6)

        # units sold per product (all time) from paid orders
        sold_qs = (
            OrderItem.objects.filter(
                order__payment_status=Order.PaymentStatus.PAID,
                product__isnull=False,
            )
            .values('product_id')
            .annotate(total_sold=Sum('quantity'))
        )
        sold_map = {str(row['product_id']): row['total_sold'] for row in sold_qs}

        # units sold today per product
        sold_today_qs = (
            OrderItem.objects.filter(
                order__payment_status=Order.PaymentStatus.PAID,
                order__updated_at__date=today,
                product__isnull=False,
            )
            .values('product_id')
            .annotate(total_sold=Sum('quantity'))
        )
        sold_today_map = {str(row['product_id']): row['total_sold'] for row in sold_today_qs}

        # 7-day sparkline: daily sales per product
        sparkline_qs = (
            OrderItem.objects.filter(
                order__payment_status=Order.PaymentStatus.PAID,
                order__updated_at__date__gte=seven_days_ago,
                product__isnull=False,
            )
            .annotate(day=TruncDate('order__updated_at'))
            .values('product_id', 'day')
            .annotate(count=Sum('quantity'))
        )
        sparkline_raw = {}
        for row in sparkline_qs:
            pid = str(row['product_id'])
            if pid not in sparkline_raw:
                sparkline_raw[pid] = {}
            sparkline_raw[pid][row['day']] = row['count']
        days_range = [today - timedelta(days=i) for i in range(6, -1, -1)]

        # Newest first. This was ordered alphabetically by category then name,
        # so a product you just created landed wherever it fell in the alphabet —
        # frequently past the 50-row page boundary, which looked like it had not
        # been created at all.
        products = (
            Product.objects.select_related('category')
            .order_by('-created_at')
        )

        data = []
        total_units_sold_today = 0
        total_stock_remaining = 0

        for p in products:
            pid = str(p.id)
            units_sold = sold_map.get(pid, 0)
            units_sold_today = sold_today_map.get(pid, 0)
            total_units_sold_today += units_sold_today
            if p.is_active:
                total_stock_remaining += p.quantity_available
            sparkline = [sparkline_raw.get(pid, {}).get(d, 0) for d in days_range]
            revenue = float(p.price) * units_sold
            data.append({
                'id': pid,
                'name': p.name,
                'category_name': p.category.name if p.category else '—',
                'quantity_available': p.quantity_available,
                'price': str(p.price),
                'units_sold': units_sold,
                'units_sold_today': units_sold_today,
                'revenue': round(revenue, 2),
                'sparkline': sparkline,
                # Was a hardcoded < 15, ignoring the per-product
                # low_stock_threshold the admin can actually set.
                'low_stock': p.quantity_available <= p.low_stock_threshold,
                'is_active': p.is_active,
            })

        return build_success_response(
            message="Products retrieved.",
            data={
                'products': data,
                'summary': {
                    'total_products': len(data),
                    'total_units_sold_today': total_units_sold_today,
                    'total_stock_remaining': total_stock_remaining,
                },
            },
            status_code=200
        )


class AdminProductCreateAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.common.storage.service import storage_service
        from django.utils.text import slugify
        from naderk.ecommerce.models import Product, ProductVariant, StoreCategory

        name = request.data.get('name', '').strip()
        description = request.data.get('description', '').strip()
        category_id = request.data.get('category_id')
        price = request.data.get('price')
        quantity_available = request.data.get('quantity_available', 0)
        low_stock_threshold = request.data.get('low_stock_threshold', 5)

        if not all([name, description, category_id, price]):
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='name, description, category_id and price are required.',
            )

        try:
            category = StoreCategory.objects.get(id=category_id)
        except StoreCategory.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Category not found.',
            )

        image_urls = []
        upload_errors = []
        for key in ['image_0', 'image_1', 'image_2', 'image_3', 'image_4']:
            file = request.FILES.get(key)
            if file:
                try:
                    result = storage_service.upload_file(file, bucket_type='public', prefix='products', uploaded_by=request.user)
                    image_urls.append(result.url)
                except Exception as e:
                    # This used to be a bare `except: pass`. A failing upload
                    # produced a product with images=[] and no trace anywhere —
                    # the admin saw "created", the storefront showed no picture,
                    # and nothing said why. Log it and tell the caller.
                    logger.exception("Product image upload failed for %s: %s", key, e)
                    upload_errors.append(f"{getattr(file, 'name', key)}: {e}")

        # Generate unique slug
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while Product.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        product = Product.objects.create(
            name=name,
            slug=slug,
            description=description,
            category=category,
            price=price,
            images=image_urls,
            quantity_available=int(quantity_available),
            low_stock_threshold=int(low_stock_threshold),
            is_active=True,
        )

        if upload_errors:
            logger.error("Product %s created with %d failed image upload(s): %s",
                         product.id, len(upload_errors), '; '.join(upload_errors))

        # Create variants if provided
        import json
        variants_raw = request.data.get('variants')
        if variants_raw:
            try:
                variants = json.loads(variants_raw) if isinstance(variants_raw, str) else variants_raw
                for v in variants:
                    vname = str(v.get('variant_name', '')).strip()
                    if not vname:
                        continue
                    ProductVariant.objects.create(
                        product=product,
                        variant_name=vname,
                        sku=v.get('sku') or None,
                        quantity_available=int(v.get('quantity_available', 0)),
                        low_stock_threshold=int(v.get('low_stock_threshold', 5)),
                        price_modifier=float(v.get('price_modifier', 0)),
                        is_active=True,
                    )
            except (json.JSONDecodeError, TypeError, ValueError):
                pass

        return build_success_response(
            message="Product created successfully.",
            data={'id': str(product.id), 'name': product.name},
            status_code=201
        )


class AdminProductRestockAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Product not found.',
            )

        quantity = int(request.data.get('quantity', 0))
        if quantity <= 0:
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Quantity must be positive.',
            )

        product.quantity_available += quantity
        product.save(update_fields=['quantity_available'])

        return build_success_response(
            message="Stock updated.",
            data={'id': str(product.id), 'quantity_available': product.quantity_available},
            status_code=200
        )


class AdminProductToggleStatusAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Product not found.',
            )

        product.is_active = not product.is_active
        product.save(update_fields=['is_active'])

        return build_success_response(
            message="Status updated.",
            data={'id': str(product.id), 'is_active': product.is_active},
            status_code=200
        )


class AdminProductDetailAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.prefetch_related('variants').select_related('category').get(id=pk)
        except Product.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Not found.',
            )
        return build_success_response(message="Product retrieved.", data={
            'id': str(product.id),
            'name': product.name,
            'description': product.description,
            'category_id': str(product.category_id),
            'category_name': product.category.name,
            'price': str(product.price),
            'quantity_available': product.quantity_available,
            'low_stock_threshold': product.low_stock_threshold,
            'is_active': product.is_active,
            'images': product.images,
            'slug': product.slug,
            'variants': [
                {
                    'id': str(v.id),
                    'variant_name': v.variant_name,
                    'sku': v.sku or '',
                    'price_modifier': str(v.price_modifier),
                    'quantity_available': v.quantity_available,
                    'low_stock_threshold': v.low_stock_threshold,
                    'is_active': v.is_active,
                }
                for v in product.variants.all()
            ],
        }, status_code=200)

    def patch(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import Product, StoreCategory
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Not found.',
            )
        if 'name' in request.data:
            product.name = request.data['name'].strip()
        if 'description' in request.data:
            product.description = request.data['description'].strip()
        if 'price' in request.data:
            product.price = request.data['price']
        if 'quantity_available' in request.data:
            product.quantity_available = int(request.data['quantity_available'])
        if 'low_stock_threshold' in request.data:
            product.low_stock_threshold = int(request.data['low_stock_threshold'])
        if 'category_id' in request.data:
            try:
                product.category = StoreCategory.objects.get(id=request.data['category_id'])
            except StoreCategory.DoesNotExist:
                return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Category not found.',
            )
        # Images and active state were not editable at all — the edit form could
        # change a product's text and price but never its picture, so a product
        # created with a failed upload could not be repaired without deleting it.
        # URLs come from POST /storage/upload/, same as the create form.
        if 'images' in request.data:
            imgs = request.data.get('images') or []
            if not isinstance(imgs, list):
                return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='images must be a list of URLs.',
            )
            product.images = [u for u in imgs if isinstance(u, str) and u.strip()][:5]
        if 'is_active' in request.data:
            product.is_active = bool(request.data['is_active'])
        product.save()
        return build_success_response(message="Product updated.", data={'id': str(product.id)}, status_code=200)

    def delete(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Not found.',
            )
        product.delete()
        return build_success_response(message="Product deleted.", data={}, status_code=200)


class AdminProductHistoryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.ecommerce.models import OrderItem
        items = (
            OrderItem.objects.filter(
                product_id=pk,
                order__payment_status=Order.PaymentStatus.PAID,
            )
            .select_related('order__user')
            .order_by('-order__updated_at')[:30]
        )

        history = []
        for item in items:
            history.append({
                'type': 'SOLD',
                'quantity': item.quantity,
                'customer': f"{item.order.user.first_name} {item.order.user.last_name}".strip() or item.order.user.email,
                'order_id': str(item.order.id)[:8].upper(),
                'date': item.order.updated_at.isoformat(),
            })

        return build_success_response(message="History retrieved.", data=history, status_code=200)


class AdminAllOrdersAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'orders'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        status_filter = request.query_params.get('status')
        qs = (
            Order.objects.select_related('user')
            .prefetch_related('items__product', 'items__frame_variant__frame')
            .order_by('-created_at')
        )
        if status_filter:
            qs = qs.filter(status=status_filter)

        data = []
        for o in qs[:20]:
            first_item = o.items.first()
            item_name = '—'
            item_image = None
            item_qty = 0
            if first_item:
                item_qty = first_item.quantity
                if first_item.product:
                    item_name = first_item.product.name
                    imgs = first_item.product.images
                    item_image = imgs[0] if imgs else None
                elif first_item.frame_variant and first_item.frame_variant.frame:
                    item_name = first_item.frame_variant.frame.name

            data.append({
                'id': str(o.id),
                'customer_name': f"{o.user.first_name} {o.user.last_name}".strip() or o.user.email,
                'status': o.status,
                'total_price': str(o.total_price),
                'created_at': o.created_at.isoformat(),
                'first_item_name': item_name,
                'first_item_image': item_image,
                'first_item_qty': item_qty,
            })

        return build_success_response(message="Orders retrieved.", data=data, status_code=200)


# ── Category Management ──────────────────────────────────────────────────────

class AdminCategoryListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import StoreCategory
        cats = StoreCategory.objects.filter(parent=None).prefetch_related('children').order_by('name')
        data = []
        for c in cats:
            data.append({
                'id': str(c.id),
                'name': c.name,
                'slug': c.slug,
                'description': c.description or '',
                'product_count': c.products.count(),
            })
        return build_success_response(message="Categories retrieved.", data=data, status_code=200)

    def post(self, request):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import StoreCategory
        from django.utils.text import slugify
        name = (request.data.get('name') or '').strip()
        if not name:
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Name is required.',
            )
        description = (request.data.get('description') or '').strip()
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while StoreCategory.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
        cat = StoreCategory.objects.create(name=name, slug=slug, description=description or None)
        return build_success_response(
            message="Category created.",
            data={'id': str(cat.id), 'name': cat.name, 'slug': cat.slug, 'description': cat.description or '', 'product_count': 0},
            status_code=201
        )


class AdminCategoryDetailAPI(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import StoreCategory
        try:
            cat = StoreCategory.objects.get(id=pk)
        except StoreCategory.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Category not found.',
            )
        if 'name' in request.data:
            cat.name = request.data['name'].strip()
        if 'description' in request.data:
            cat.description = request.data['description'].strip() or None
        cat.save()
        return build_success_response(
            message="Category updated.",
            data={'id': str(cat.id), 'name': cat.name, 'description': cat.description or ''},
            status_code=200
        )

    def delete(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import StoreCategory
        try:
            cat = StoreCategory.objects.get(id=pk)
        except StoreCategory.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Category not found.',
            )
        if cat.products.exists():
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Cannot delete a category that has products.',
            )
        cat.delete()
        return build_success_response(message="Category deleted.", data={}, status_code=200)


# ── Flash Sale Management ─────────────────────────────────────────────────────

class AdminFlashSaleListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import FlashSale
        now = timezone.now()
        sales = FlashSale.objects.prefetch_related('products').order_by('-created_at')
        data = []
        for s in sales:
            is_live = s.is_active and s.starts_at <= now <= s.ends_at
            data.append({
                'id': str(s.id),
                'name': s.name,
                'discount_percent': str(s.discount_percent),
                'starts_at': s.starts_at.isoformat(),
                'ends_at': s.ends_at.isoformat(),
                'is_active': s.is_active,
                'is_live': is_live,
                'product_count': s.products.count(),
                'product_ids': [str(p.id) for p in s.products.all()],
            })
        return build_success_response(message="Flash sales retrieved.", data=data, status_code=200)

    def post(self, request):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import FlashSale, Product
        name = (request.data.get('name') or '').strip()
        discount_percent = request.data.get('discount_percent')
        starts_at = request.data.get('starts_at')
        ends_at = request.data.get('ends_at')
        product_ids = request.data.get('product_ids', [])

        if not all([name, discount_percent, starts_at, ends_at]):
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='name, discount_percent, starts_at, ends_at are required.',
            )
        try:
            discount_percent = float(discount_percent)
            if not (0 < discount_percent <= 100):
                raise ValueError
        except (ValueError, TypeError):
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='discount_percent must be between 1 and 100.',
            )

        from django.utils.dateparse import parse_datetime
        starts = parse_datetime(starts_at)
        ends = parse_datetime(ends_at)
        if not starts or not ends or ends <= starts:
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Invalid date range.',
            )

        sale = FlashSale.objects.create(
            name=name,
            discount_percent=discount_percent,
            starts_at=starts,
            ends_at=ends,
            is_active=True,
        )
        if product_ids:
            products = Product.objects.filter(id__in=product_ids)
            sale.products.set(products)

        return build_success_response(
            message="Flash sale created.",
            data={'id': str(sale.id), 'name': sale.name, 'discount_percent': str(sale.discount_percent)},
            status_code=201
        )


class AdminFlashSaleDetailAPI(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import FlashSale, Product
        try:
            sale = FlashSale.objects.get(id=pk)
        except FlashSale.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Flash sale not found.',
            )
        for field in ['name', 'is_active']:
            if field in request.data:
                setattr(sale, field, request.data[field])
        if 'discount_percent' in request.data:
            sale.discount_percent = float(request.data['discount_percent'])
        from django.utils.dateparse import parse_datetime
        if 'starts_at' in request.data:
            sale.starts_at = parse_datetime(request.data['starts_at'])
        if 'ends_at' in request.data:
            sale.ends_at = parse_datetime(request.data['ends_at'])
        sale.save()
        if 'product_ids' in request.data:
            products = Product.objects.filter(id__in=request.data['product_ids'])
            sale.products.set(products)
        return build_success_response(message="Flash sale updated.", data={'id': str(sale.id)}, status_code=200)

    def delete(self, request, pk):
        if _admin_only(request, 'inventory'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.ecommerce.models import FlashSale
        try:
            sale = FlashSale.objects.get(id=pk)
        except FlashSale.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Flash sale not found.',
            )
        sale.delete()
        return build_success_response(message="Flash sale deleted.", data={}, status_code=200)


class AdminActiveFlashSaleAPI(APIView):
    """Public-facing: returns currently live flash sale with discounted prices."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from naderk.ecommerce.models import FlashSale
        now = timezone.now()
        sale = (
            FlashSale.objects
            .filter(is_active=True, starts_at__lte=now, ends_at__gte=now)
            .prefetch_related('products')
            .first()
        )
        if not sale:
            return build_success_response(message="No active flash sale.", data=None, status_code=200)
        products = []
        for p in sale.products.filter(is_active=True):
            original = float(p.price)
            discounted = round(original * (1 - float(sale.discount_percent) / 100), 2)
            products.append({
                'id': str(p.id),
                'name': p.name,
                'original_price': str(original),
                'discounted_price': str(discounted),
                'images': p.images,
            })
        return build_success_response(
            message="Active flash sale.",
            data={
                'id': str(sale.id),
                'name': sale.name,
                'discount_percent': str(sale.discount_percent),
                'ends_at': sale.ends_at.isoformat(),
                'products': products,
            },
            status_code=200
        )


# ── Staff Management ──────────────────────────────────────────────────────────

class AdminStaffListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.core.models import User
        staff_roles = ['DOCTOR', 'OPTICIAN', 'MEDICAL_AGENT', 'ADMIN', 'SUPER_ADMIN']
        users = (
            User.objects.filter(role__in=staff_roles)
            .select_related('staff_profile', 'doctor_profile')
            .order_by('first_name', 'last_name')
        )

        active_doctor_ids = set(
            TelehealthSession.objects.filter(status=TelehealthSession.Status.ACTIVE)
            .values_list('doctor_id', flat=True)
        )

        data = []
        for u in users:
            profile = getattr(u, 'staff_profile', None)
            doc = getattr(u, 'doctor_profile', None)

            if u.id in active_doctor_ids:
                status = 'IN_SESSION'
            elif doc and doc.availability_status == 'AVAILABLE':
                status = 'ONLINE'
            else:
                status = 'OFFLINE'

            avatar = None
            if doc:
                avatar = doc.avatar or doc.profile_picture
            elif profile:
                avatar = profile.profile_picture

            employee_id = (profile.employee_id if profile else None) or f"NDK{str(u.id).replace('-','')[:5].upper()}"
            department = (profile.department if profile else None) or (doc.specialization_display if doc else u.get_role_display())
            job_title = doc.specialization_display if doc else u.get_role_display()

            data.append({
                'id': str(u.id),
                'name': f"{u.first_name} {u.last_name}".strip() or u.email,
                'email': u.email,
                'phone': getattr(u, 'phone_number', '') or '',
                'role': u.role,
                'employee_id': employee_id,
                'department': department,
                'job_title': job_title,
                'avatar': avatar,
                'office_address': (profile.office_address if profile else '') or '',
                'employment_date': profile.employment_date.isoformat() if profile and profile.employment_date else None,
                'status': status,
                'is_active': u.is_active,
            })

        return build_success_response(message="Staff retrieved.", data=data, status_code=200)

    def post(self, request):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from django.db import transaction
        from django.conf import settings
        from django.template.loader import render_to_string
        from naderk.core.models import User
        from naderk.authentication.models import PasswordResetToken
        from naderk.common.email._provider_registry import get_provider
        from naderk.common.email.providers.base import EmailMessage
        from naderk.common.email.exceptions import EmailError
        import secrets
        import datetime

        first_name = (request.data.get('first_name') or '').strip()
        last_name  = (request.data.get('last_name')  or '').strip()
        email      = (request.data.get('email')       or '').strip().lower()
        role       = (request.data.get('role')        or '').strip()
        phone      = (request.data.get('phone_number') or '').strip()
        department = (request.data.get('department')  or '').strip()
        specialization = (request.data.get('specialization') or '').strip()

        ALLOWED_ROLES = ['DOCTOR', 'OPTICIAN', 'MEDICAL_AGENT', 'OPERATIONS_MANAGER', 'AGENT', 'ADMIN']
        if not all([first_name, email, role]):
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail="first_name, email, and role are required.",
            )
        if role not in ALLOWED_ROLES:
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail=f"Invalid role. Must be one of: {', '.join(ALLOWED_ROLES)}",
            )
        if User.objects.filter(email=email).exists():
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail="A user with this email already exists.",
            )
        # A doctor with no specialization silently inherits the signal default and
        # then never matches the services they were hired for — require it here.
        if role == 'DOCTOR':
            if not specialization:
                return build_error_response(
                    type_uri='validation-error', title='Validation Error', status_code=400,
                    detail="Specialization is required for doctors.",
                    errors={'specialization': ['Please select a specialization.']},
                )
            err = _validate_specialization_code(specialization, field='specialization')
            if err:
                return err

        ROLE_DISPLAY = {
            'DOCTOR': 'Doctor',
            'OPTICIAN': 'Optician',
            'MEDICAL_AGENT': 'Medical Agent',
            'ADMIN': 'Administrator',
        }

        try:
            with transaction.atomic():
                # Create user with an unusable password — staff must set their
                # own via the invite link.
                user = User(
                    email=email,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    is_active=True,
                    is_verified=True,
                    otp_verified=True,
                )
                if phone:
                    user.phone_number = phone
                user.set_unusable_password()
                user.save()
                # Signal auto-creates StaffProfile / DoctorProfile.
                # Apply department override if provided.
                if department and hasattr(user, 'staff_profile'):
                    user.staff_profile.department = department
                    user.staff_profile.save(update_fields=['department'])

                if role == 'DOCTOR' and specialization and hasattr(user, 'doctor_profile'):
                    user.doctor_profile.specialization = specialization
                    user.doctor_profile.save(update_fields=['specialization'])
                    # Without a schedule the doctor gets recommended (the
                    # assignment fallback covers unscheduled doctors) but shows
                    # zero bookable slots. Seed the same Mon–Fri 8–5 default the
                    # self-onboarding path uses; they can edit it afterwards.
                    from naderk.users.apis import _seed_default_availability
                    _seed_default_availability(user)

                # Create a 24-hour invite token (reuses PasswordResetToken).
                token = secrets.token_urlsafe(32)
                expires_at = timezone.now() + datetime.timedelta(hours=24)
                PasswordResetToken.objects.create(
                    user=user, token=token, expires_at=expires_at,
                )

                # Build the invite URL pointing at the frontend reset-password page.
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
                invite_url = f"{frontend_url}/reset-password?token={token}"
                brand = getattr(settings, 'BRAND_NAME', 'Naderkela')

                html = render_to_string('email/authentication/staff_invite.html', {
                    'brand_name': brand,
                    'brand_logo_url': getattr(settings, 'BRAND_LOGO_URL', ''),
                    'first_name': first_name,
                    'email': email,
                    'role_display': ROLE_DISPLAY.get(role, role.title()),
                    'invite_url': invite_url,
                    'expires_minutes': 1440,
                })

                # Send synchronously — failure rolls back the user row.
                provider = get_provider()
                provider.send(EmailMessage(
                    to=[email],
                    subject=f"You've been invited to {brand}",
                    html_body=html,
                    text_body=(
                        f"Hi {first_name},\n\n"
                        f"You've been added to {brand} as {ROLE_DISPLAY.get(role, role)}.\n\n"
                        f"Set your password here (expires in 24 hours):\n{invite_url}\n\n"
                        f"Your login email: {email}"
                    ),
                    tags=['staff-invite'],
                ))

        except EmailError as exc:
            return build_error_response(
                type_uri='email-error', title='Email Error', status_code=400,
                detail="Could not send the invite email. Please check the email address and try again.",
            )

        employee_id = getattr(getattr(user, 'staff_profile', None), 'employee_id', '')
        return build_success_response(
            message="Staff member created and invite email sent.",
            data={
                'id': str(user.id),
                'name': f"{user.first_name} {user.last_name}".strip(),
                'email': user.email,
                'role': user.role,
                'employee_id': employee_id,
                'email_sent': True,
            },
            status_code=201,
        )


class AdminStaffToggleAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from naderk.core.models import User
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='User not found.',
            )

        user.is_active = not user.is_active
        user.save(update_fields=['is_active'])
        return build_success_response(
            message="Status updated.",
            data={'id': str(user.id), 'is_active': user.is_active},
            status_code=200
        )


class AdminWeekScheduleAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'appointments'):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )

        from collections import defaultdict
        from naderk.core.models import User

        today = timezone.now().date()
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)

        appts = (
            Appointment.objects
            .filter(appointment_date__range=[week_start, week_end])
            .exclude(status=Appointment.Status.CANCELLED)
            .select_related('doctor')
        )

        by_day = defaultdict(list)
        for a in appts:
            by_day[a.appointment_date.isoformat()].append(a)

        schedule = []
        for i in range(7):
            day = week_start + timedelta(days=i)
            day_appts = by_day[day.isoformat()]

            by_type = defaultdict(list)
            for a in day_appts:
                by_type[a.appointment_type].append(a)

            primary_type = max(by_type, key=lambda t: len(by_type[t])) if by_type else 'PHYSICAL'

            seen_ids = set()
            doctor_names = []
            doctor_ids = []
            for a in day_appts:
                if a.doctor_id and a.doctor_id not in seen_ids:
                    seen_ids.add(a.doctor_id)
                    doctor_ids.append(str(a.doctor_id))
                    name = f"{a.doctor.first_name} {a.doctor.last_name}".strip() if a.doctor else ''
                    if name:
                        doctor_names.append(name)

            schedule.append({
                'date': day.isoformat(),
                'weekday': day.strftime('%a'),
                'appointment_type': primary_type,
                'staff_count': len(seen_ids),
                'doctor_ids': doctor_ids[:3],
                'doctor_names': doctor_names[:3],
                'extra_count': max(0, len(seen_ids) - 3),
            })

        # Summary
        staff_roles = ['DOCTOR', 'OPTICIAN', 'MEDICAL_AGENT', 'ADMIN', 'SUPER_ADMIN']
        all_staff = User.objects.filter(role__in=staff_roles, is_active=True)
        total = all_staff.count()
        doctors_count = all_staff.filter(role='DOCTOR').count()
        opticians_count = all_staff.filter(role='OPTICIAN').count()
        others_count = total - doctors_count - opticians_count

        on_duty = (
            Appointment.objects
            .filter(appointment_date=today, status__in=['CONFIRMED', 'IN_PROGRESS', 'CHECKED_IN'])
            .values('doctor_id').distinct().count()
        )
        avail_pct = round(on_duty / doctors_count * 100) if doctors_count else 0

        return build_success_response(
            message="Schedule retrieved.",
            data={
                'week_start': week_start.isoformat(),
                'week_end': week_end.isoformat(),
                'schedule': schedule,
                'summary': {
                    'total_active': total,
                    'doctors': doctors_count,
                    'opticians': opticians_count,
                    'others': others_count,
                    'on_duty_doctors': on_duty,
                    'total_doctors': doctors_count,
                    'availability_pct': avail_pct,
                },
            },
            status_code=200
        )


# ── Department Management ─────────────────────────────────────────────────────

class AdminDepartmentListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.users.models import Department
        depts = Department.objects.filter(is_active=True)
        data = [{'id': str(d.id), 'name': d.name, 'description': d.description or ''} for d in depts]
        return build_success_response(message="Departments retrieved.", data=data, status_code=200)

    def post(self, request):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.users.models import Department
        name = (request.data.get('name') or '').strip()
        if not name:
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Name is required.',
            )
        if Department.objects.filter(name__iexact=name).exists():
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Department already exists.',
            )
        dept = Department.objects.create(name=name, description=(request.data.get('description') or '').strip() or None)
        return build_success_response(
            message="Department created.",
            data={'id': str(dept.id), 'name': dept.name, 'description': dept.description or ''},
            status_code=201
        )


class AdminDepartmentDetailAPI(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.users.models import Department
        try:
            dept = Department.objects.get(id=pk)
        except Department.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Not found.',
            )
        if 'name' in request.data:
            dept.name = request.data['name'].strip()
        if 'description' in request.data:
            dept.description = request.data['description'].strip() or None
        dept.save()
        return build_success_response(message="Department updated.", data={'id': str(dept.id), 'name': dept.name}, status_code=200)

    def delete(self, request, pk):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.users.models import Department
        try:
            dept = Department.objects.get(id=pk)
        except Department.DoesNotExist:
            return build_error_response(
                type_uri='not-found', title='Not Found', status_code=404,
                detail='Not found.',
            )
        dept.is_active = False
        dept.save(update_fields=['is_active'])
        return build_success_response(message="Department removed.", data={}, status_code=200)


# ── Specialization Management ─────────────────────────────────────────────────

def _serialize_specialization(s, usage=None):
    data = {
        'id': str(s.id),
        'code': s.code,
        'name': s.name,
        'description': s.description or '',
        'is_active': s.is_active,
    }
    if usage is not None:
        doctors, services = usage
        # doctor_count lets the service form warn before an admin creates a
        # service no doctor can ever be assigned to.
        data['doctor_count'] = doctors
        data['service_count'] = services
        data['in_use'] = doctors + services
    return data


def _validate_specialization_code(code, field='required_specialization'):
    """Returns an error response if `code` isn't an active specialization, else None.
    Booking matches doctors on this exact string, so an unknown code produces a
    service nobody can ever be assigned to."""
    from naderk.users.models import Specialization
    if Specialization.objects.filter(code=code, is_active=True).exists():
        return None
    valid = list(Specialization.objects.filter(is_active=True).values_list('code', flat=True))
    msg = f'Invalid specialization. Must be one of: {", ".join(valid) if valid else "(none configured)"}.'
    return build_error_response('validation-error', 'Validation Error', 400, msg, errors={field: [msg]})


def _specialization_usage(code):
    """How many doctors and services currently point at this code."""
    from naderk.users.models import DoctorProfile
    from naderk.appointments.models import MedicalService
    return (
        DoctorProfile.objects.filter(specialization=code).count(),
        MedicalService.objects.filter(required_specialization=code).count(),
    )


class SpecializationListAPI(APIView):
    """
    GET  — list specializations. Readable by any signed-in user, because the
           doctor onboarding and profile forms need it, not just admins.
    POST — create one (admin only).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from naderk.users.models import Specialization
        qs = Specialization.objects.all()
        # Only admins managing the list need to see deactivated entries; every
        # other caller is filling a dropdown and must only get valid choices.
        if _admin_only(request) or request.query_params.get('include_inactive') != 'true':
            qs = qs.filter(is_active=True)
        data = [
            _serialize_specialization(s, usage=_specialization_usage(s.code))
            for s in qs
        ]
        return build_success_response(message="Specializations retrieved.", data=data, status_code=200)

    def post(self, request):
        if _admin_only(request):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.users.models import Specialization
        import re

        name = (request.data.get('name') or '').strip()
        if not name:
            return build_error_response('validation-error', 'Validation Error', 400,
                                        'Name is required.', errors={'name': ['Name is required.']})

        # Derive the stored code from the name unless one was supplied. Codes are
        # what the booking engine matches on, so normalise hard: A–Z and _ only.
        raw_code = (request.data.get('code') or name).strip().upper()
        code = re.sub(r'[^A-Z0-9]+', '_', raw_code).strip('_')
        if not code:
            return build_error_response('validation-error', 'Validation Error', 400,
                                        'Could not derive a code from that name.',
                                        errors={'name': ['Use at least one letter or number.']})
        if len(code) > 50:
            return build_error_response('validation-error', 'Validation Error', 400,
                                        'Name is too long.', errors={'name': ['Name is too long.']})
        if Specialization.objects.filter(code=code).exists():
            return build_error_response('validation-error', 'Validation Error', 400,
                                        f'A specialization with code "{code}" already exists.',
                                        errors={'name': ['This specialization already exists.']})

        spec = Specialization.objects.create(
            code=code, name=name,
            description=(request.data.get('description') or '').strip() or None,
        )
        return build_success_response(message="Specialization created.",
                                      data=_serialize_specialization(spec, usage=(0, 0)), status_code=201)


class SpecializationDetailAPI(APIView):
    """PATCH renames/reactivates; DELETE deactivates. The `code` is never
    editable — doctors and services store it, so changing it would silently
    orphan every row pointing at the old value."""
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        from naderk.users.models import Specialization
        return Specialization.objects.filter(id=pk).first()

    def patch(self, request, pk):
        if _admin_only(request):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        spec = self._get(pk)
        if not spec:
            return build_error_response('not-found', 'Not Found', 404, 'Specialization not found.')

        if 'name' in request.data:
            name = (request.data.get('name') or '').strip()
            if not name:
                return build_error_response('validation-error', 'Validation Error', 400,
                                            'Name cannot be empty.', errors={'name': ['Name is required.']})
            spec.name = name
        if 'description' in request.data:
            spec.description = (request.data.get('description') or '').strip() or None
        if 'is_active' in request.data:
            spec.is_active = bool(request.data['is_active'])
        spec.save()

        return build_success_response(
            message="Specialization updated.",
            data=_serialize_specialization(spec, usage=_specialization_usage(spec.code)),
            status_code=200,
        )

    def delete(self, request, pk):
        if _admin_only(request):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        spec = self._get(pk)
        if not spec:
            return build_error_response('not-found', 'Not Found', 404, 'Specialization not found.')

        doctors, services = _specialization_usage(spec.code)
        if doctors or services:
            parts = []
            if doctors:
                parts.append(f"{doctors} doctor{'s' if doctors != 1 else ''}")
            if services:
                parts.append(f"{services} service{'s' if services != 1 else ''}")
            return build_error_response(
                'conflict', 'Specialization in use', 409,
                f'"{spec.name}" is still assigned to {" and ".join(parts)}. '
                f'Reassign them first, or deactivate it to hide it from new selections.',
            )

        spec.is_active = False
        spec.save(update_fields=['is_active'])
        return build_success_response(message="Specialization removed.", data={}, status_code=200)


# ── Role Permissions Management ───────────────────────────────────────────────

SYSTEM_PERMISSIONS = [
    {'id': 'view_patient_records',   'label': 'View Patient Records',       'category': 'Records'},
    {'id': 'edit_patient_records',   'label': 'Edit Patient Records',       'category': 'Records'},
    {'id': 'manage_appointments',    'label': 'Manage Appointments',        'category': 'Appointments'},
    {'id': 'conduct_telehealth',     'label': 'Conduct Telehealth Sessions','category': 'Clinical'},
    {'id': 'manage_prescriptions',   'label': 'Manage Prescriptions',       'category': 'Clinical'},
    {'id': 'view_billing',           'label': 'View Billing',               'category': 'Finance'},
    {'id': 'manage_billing',         'label': 'Manage Billing',             'category': 'Finance'},
    {'id': 'manage_inventory',       'label': 'Manage Inventory',           'category': 'Inventory'},
    {'id': 'view_reports',           'label': 'View Reports',               'category': 'Reporting'},
    {'id': 'manage_staff',           'label': 'Manage Staff',               'category': 'Administration'},
    {'id': 'manage_cms',             'label': 'Manage CMS Content',         'category': 'Administration'},
    {'id': 'access_messaging',       'label': 'Access Messaging',           'category': 'Communication'},
]

MANAGEABLE_ROLES = ['DOCTOR', 'OPTICIAN', 'MEDICAL_AGENT', 'OPERATIONS_MANAGER', 'AGENT', 'ADMIN']


class AdminPermissionsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.users.models import RolePermissionConfig
        configs = {c.role: c.permissions for c in RolePermissionConfig.objects.filter(role__in=MANAGEABLE_ROLES)}
        roles = []
        for role in MANAGEABLE_ROLES:
            roles.append({'role': role, 'permissions': configs.get(role, [])})
        return build_success_response(
            message="Permissions retrieved.",
            data={'roles': roles, 'available_permissions': SYSTEM_PERMISSIONS},
            status_code=200
        )

    def post(self, request):
        if _admin_only(request):
            return build_error_response(
                type_uri='forbidden', title='Forbidden', status_code=403,
                detail='Forbidden.',
            )
        from naderk.users.models import RolePermissionConfig
        role = (request.data.get('role') or '').strip()
        permissions = request.data.get('permissions', [])
        if role not in MANAGEABLE_ROLES:
            return build_error_response(
                type_uri='validation-error', title='Validation Error', status_code=400,
                detail='Invalid role.',
            )
        valid_ids = {p['id'] for p in SYSTEM_PERMISSIONS}
        clean_perms = [p for p in permissions if p in valid_ids]
        config, _ = RolePermissionConfig.objects.get_or_create(role=role, defaults={'permissions': []})
        config.permissions = clean_perms
        config.save()
        return build_success_response(message="Permissions updated.", data={'role': role, 'permissions': clean_perms}, status_code=200)


# ─── Admin Medical Services ───────────────────────────────────────────────────

class AdminServiceListAPI(APIView):
    """
    GET  /dashboard/admin/services/        — list all services (active + inactive)
    POST /dashboard/admin/services/        — create a service
    """
    permission_classes = [IsAuthenticated]

    def _serialize(self, s):
        return {
            'id': str(s.id),
            'name': s.name,
            'slug': s.slug,
            'description': s.description or '',
            'requires_doctor': s.requires_doctor,
            'available_online': s.available_online,
            'required_specialization': s.required_specialization,
            'duration_minutes': s.duration_minutes,
            'buffer_time_before': s.buffer_time_before,
            'buffer_time_after': s.buffer_time_after,
            'fee': str(s.fee),
            'billing_type': s.billing_type,
            'sessions_included': s.sessions_included,
            'is_active': s.is_active,
            'created_at': s.created_at.isoformat(),
        }

    def get(self, request):
        if _admin_only(request, 'services'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.appointments.models import MedicalService
        services = MedicalService.objects.all().order_by('name')
        return build_success_response(
            message="Services retrieved.",
            data=[self._serialize(s) for s in services],
            status_code=200,
        )

    def post(self, request):
        if _admin_only(request, 'services'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.appointments.models import MedicalService
        from django.utils.text import slugify

        name = (request.data.get('name') or '').strip()
        billing_type = (request.data.get('billing_type') or 'PER_VISIT').strip()
        requires_doctor = bool(request.data.get('requires_doctor', True))
        available_online = bool(request.data.get('available_online', False)) if requires_doctor else False
        specialization = (request.data.get('required_specialization') or '').strip() or None

        if not name:
            return build_error_response('validation-error', 'Validation Error', 400, 'name is required.',
                                        errors={'name': ['Service name is required.']})
        if MedicalService.objects.filter(name__iexact=name).exists():
            msg = f'A service named "{name}" already exists.'
            return build_error_response('validation-error', 'Validation Error', 400, msg,
                                        errors={'name': [msg]})
        if requires_doctor and not specialization:
            msg = 'Specialization is required when a doctor is needed.'
            return build_error_response('validation-error', 'Validation Error', 400, msg,
                                        errors={'required_specialization': [msg]})
        # Must be an active specialization code, or no doctor will ever match
        if specialization:
            err = _validate_specialization_code(specialization)
            if err:
                return err

        VALID_BILLING = ['PER_VISIT', 'MONTHLY', 'SESSION_PACK']
        if billing_type not in VALID_BILLING:
            msg = f'billing_type must be one of: {", ".join(VALID_BILLING)}'
            return build_error_response('validation-error', 'Validation Error', 400, msg,
                                        errors={'billing_type': [msg]})

        # Unique slug
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        while MedicalService.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        sessions_included = None
        if billing_type == 'SESSION_PACK':
            try:
                sessions_included = int(request.data.get('sessions_included') or 0)
                if sessions_included < 1:
                    raise ValueError
            except (TypeError, ValueError):
                msg = 'Number of sessions is required for Session Pack.'
                return build_error_response('validation-error', 'Validation Error', 400, msg,
                                            errors={'sessions_included': [msg]})

        try:
            fee = float(request.data.get('fee') or 0)
        except (TypeError, ValueError):
            return build_error_response('validation-error', 'Validation Error', 400, 'fee must be a number.',
                                        errors={'fee': ['Valid fee is required.']})

        service = MedicalService.objects.create(
            name=name,
            slug=slug,
            description=(request.data.get('description') or '').strip() or None,
            requires_doctor=requires_doctor,
            available_online=available_online,
            required_specialization=specialization,
            duration_minutes=int(request.data.get('duration_minutes') or 30),
            buffer_time_before=int(request.data.get('buffer_time_before') or 0),
            buffer_time_after=int(request.data.get('buffer_time_after') or 5),
            fee=fee,
            billing_type=billing_type,
            sessions_included=sessions_included,
            is_active=bool(request.data.get('is_active', True)),
        )
        return build_success_response(
            message="Service created.",
            data=self._serialize(service),
            status_code=201,
        )


class AdminServiceDetailAPI(APIView):
    """
    GET    /dashboard/admin/services/<pk>/   — retrieve one service
    PATCH  /dashboard/admin/services/<pk>/   — update fields
    DELETE /dashboard/admin/services/<pk>/   — soft-delete (is_active=False)
    """
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        from naderk.appointments.models import MedicalService
        try:
            return MedicalService.objects.get(id=pk)
        except MedicalService.DoesNotExist:
            return None

    def _serialize(self, s):
        return {
            'id': str(s.id),
            'name': s.name,
            'slug': s.slug,
            'description': s.description or '',
            'requires_doctor': s.requires_doctor,
            'available_online': s.available_online,
            'required_specialization': s.required_specialization,
            'duration_minutes': s.duration_minutes,
            'buffer_time_before': s.buffer_time_before,
            'buffer_time_after': s.buffer_time_after,
            'fee': str(s.fee),
            'billing_type': s.billing_type,
            'sessions_included': s.sessions_included,
            'is_active': s.is_active,
            'created_at': s.created_at.isoformat(),
        }

    def get(self, request, pk):
        if _admin_only(request, 'services'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        service = self._get(pk)
        if not service:
            return build_error_response('not-found', 'Not Found', 404, 'Service not found.')
        return build_success_response(message="Service retrieved.", data=self._serialize(service), status_code=200)

    def patch(self, request, pk):
        if _admin_only(request, 'services'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        service = self._get(pk)
        if not service:
            return build_error_response('not-found', 'Not Found', 404, 'Service not found.')

        VALID_BILLING = ['PER_VISIT', 'MONTHLY', 'SESSION_PACK']

        # Enforce unique service name (case-insensitive), excluding this service
        if 'name' in request.data:
            from naderk.appointments.models import MedicalService
            new_name = (request.data.get('name') or '').strip()
            if not new_name:
                return build_error_response('validation-error', 'Validation Error', 400, 'name cannot be empty.',
                                            errors={'name': ['Service name is required.']})
            if MedicalService.objects.filter(name__iexact=new_name).exclude(id=pk).exists():
                msg = f'A service named "{new_name}" already exists.'
                return build_error_response('validation-error', 'Validation Error', 400, msg,
                                            errors={'name': [msg]})

        # Must be an active specialization code, or no doctor will ever match
        if request.data.get('required_specialization'):
            err = _validate_specialization_code(request.data['required_specialization'])
            if err:
                return err

        fields = ['name', 'description', 'requires_doctor', 'available_online', 'required_specialization',
                  'duration_minutes', 'buffer_time_before', 'buffer_time_after', 'is_active']
        for f in fields:
            if f in request.data:
                setattr(service, f, request.data[f])

        # Clear doctor-related fields if requires_doctor was just set to false
        if 'requires_doctor' in request.data and not request.data['requires_doctor']:
            service.required_specialization = None
            service.available_online = False

        if 'fee' in request.data:
            try:
                service.fee = float(request.data['fee'])
            except (TypeError, ValueError):
                return build_error_response('validation-error', 'Validation Error', 400, 'fee must be a number.',
                                            errors={'fee': ['Valid fee is required.']})

        if 'billing_type' in request.data:
            bt = request.data['billing_type']
            if bt not in VALID_BILLING:
                msg = f'billing_type must be one of: {", ".join(VALID_BILLING)}'
                return build_error_response('validation-error', 'Validation Error', 400, msg,
                                            errors={'billing_type': [msg]})
            service.billing_type = bt

        if 'sessions_included' in request.data:
            try:
                service.sessions_included = int(request.data['sessions_included']) or None
            except (TypeError, ValueError):
                service.sessions_included = None

        service.save()
        return build_success_response(message="Service updated.", data=self._serialize(service), status_code=200)

    def delete(self, request, pk):
        if _admin_only(request, 'services'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        service = self._get(pk)
        if not service:
            return build_error_response('not-found', 'Not Found', 404, 'Service not found.')
        service.is_active = False
        service.save(update_fields=['is_active'])
        return build_success_response(message="Service deactivated.", data={}, status_code=200)


# ─── Admin Frame Management ──────────────────────────────────────────────────

def _frame_scalar_fields(data):
    """Extract & coerce the writable Frame scalar fields from request data."""
    out = {}
    for f in ['name', 'brand', 'style', 'material', 'description', 'features',
              'gender', 'rim_type', 'size_category', 'transparent_overlay_png']:
        if f in data:
            out[f] = data[f]
    for f in ['lens_width', 'bridge_width', 'temple_length', 'lens_height', 'total_width', 'weight_grams']:
        if f in data:
            v = data[f]
            out[f] = int(v) if str(v).strip() not in ('', 'None') else None
    if 'base_price' in data:
        out['base_price'] = data['base_price']
    # Up to 4 image URLs; the first becomes the primary front_image
    if 'images' in data:
        imgs = data.get('images') or []
        if isinstance(imgs, list):
            imgs = [u for u in imgs if u][:4]
            out['images'] = imgs
            out['front_image'] = imgs[0] if imgs else None
    return out


def _create_variants(frame, variants):
    from naderk.ecommerce.models import FrameVariant
    for v in variants or []:
        color = (v.get('color') or '').strip()
        size = (v.get('size') or '').strip()
        if not color or not size:
            continue
        FrameVariant.objects.create(
            frame=frame, color=color, size=size,
            quantity_available=int(v.get('quantity_available') or 0),
            low_stock_threshold=int(v.get('low_stock_threshold') or 3),
            sku=(v.get('sku') or None) or None,
            is_active=bool(v.get('is_active', True)),
        )


class AdminFrameListAPI(APIView):
    """GET all frames (active + inactive); POST create a frame with variants."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request, 'frames'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.ecommerce.models import Frame
        from naderk.ecommerce.serializers import FrameSerializer
        frames = Frame.objects.prefetch_related('variants').all().order_by('-created_at')
        return build_success_response("Frames retrieved.", FrameSerializer(frames, many=True).data)

    def post(self, request):
        if _admin_only(request, 'frames'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.ecommerce.models import Frame
        from naderk.ecommerce.serializers import FrameSerializer

        data = request.data
        name = (data.get('name') or '').strip()
        brand = (data.get('brand') or '').strip()
        if not name:
            return build_error_response('validation-error', 'Validation Error', 400, 'name is required.', errors={'name': ['Frame name is required.']})
        if not brand:
            return build_error_response('validation-error', 'Validation Error', 400, 'brand is required.', errors={'brand': ['Brand is required.']})
        bp = data.get('base_price')
        if bp is None or str(bp).strip() == '':
            return build_error_response('validation-error', 'Validation Error', 400, 'base_price is required.', errors={'base_price': ['Base price is required.']})
        try:
            float(bp)
        except (TypeError, ValueError):
            return build_error_response('validation-error', 'Validation Error', 400, 'base_price must be a number.', errors={'base_price': ['Base price must be a number.']})

        fields = _frame_scalar_fields(data)
        fields.setdefault('style', (data.get('style') or 'Rectangle'))
        fields.setdefault('material', (data.get('material') or 'Acetate'))
        try:
            frame = Frame.objects.create(**fields)
        except Exception as e:
            return build_error_response('validation-error', 'Validation Error', 400, str(e))
        _create_variants(frame, data.get('variants'))
        frame.refresh_from_db()
        return build_success_response("Frame created.", FrameSerializer(frame).data, status_code=201)


class AdminFrameDetailAPI(APIView):
    """GET, PATCH (scalar fields + optional variant replace), DELETE a frame."""
    permission_classes = [IsAuthenticated]

    def _get(self, pk):
        from naderk.ecommerce.models import Frame
        try:
            return Frame.objects.prefetch_related('variants').get(id=pk)
        except Frame.DoesNotExist:
            return None

    def get(self, request, pk):
        if _admin_only(request, 'frames'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.ecommerce.serializers import FrameSerializer
        frame = self._get(pk)
        if not frame:
            return build_error_response('not-found', 'Not Found', 404, 'Frame not found.')
        return build_success_response("Frame retrieved.", FrameSerializer(frame).data)

    def patch(self, request, pk):
        if _admin_only(request, 'frames'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.ecommerce.serializers import FrameSerializer
        frame = self._get(pk)
        if not frame:
            return build_error_response('not-found', 'Not Found', 404, 'Frame not found.')

        for key, val in _frame_scalar_fields(request.data).items():
            setattr(frame, key, val)
        if 'is_active' in request.data:
            frame.is_active = bool(request.data['is_active'])
        frame.save()

        # If variants provided, replace the full set (simple, predictable for the admin UI)
        if 'variants' in request.data:
            frame.variants.all().delete()
            _create_variants(frame, request.data.get('variants'))

        frame.refresh_from_db()
        return build_success_response("Frame updated.", FrameSerializer(frame).data)

    def delete(self, request, pk):
        if _admin_only(request, 'frames'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        frame = self._get(pk)
        if not frame:
            return build_error_response('not-found', 'Not Found', 404, 'Frame not found.')
        try:
            frame.delete()
        except Exception:
            # Referenced by carts/orders — soft-deactivate instead of hard delete
            frame.is_active = False
            frame.save(update_fields=['is_active'])
            return build_success_response("Frame is in use — deactivated instead of deleted.", {"id": str(pk), "deactivated": True})
        return build_success_response("Frame deleted.", {"id": str(pk)})


class AdminFrameToggleAPI(APIView):
    """POST toggle a frame's active status."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if _admin_only(request, 'frames'):
            return build_error_response('forbidden', 'Forbidden', 403, 'Admin access required.')
        from naderk.ecommerce.models import Frame
        from naderk.ecommerce.serializers import FrameSerializer
        try:
            frame = Frame.objects.get(id=pk)
        except Frame.DoesNotExist:
            return build_error_response('not-found', 'Not Found', 404, 'Frame not found.')
        frame.is_active = not frame.is_active
        frame.save(update_fields=['is_active'])
        return build_success_response("Frame status updated.", FrameSerializer(frame).data)
