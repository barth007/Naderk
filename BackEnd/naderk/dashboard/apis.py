from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Sum, Count, Q, F
from django.db.models.functions import TruncMonth, TruncDate
from naderk.common.responses.builders import build_success_response
from naderk.appointments.models import Appointment
from naderk.users.models import DoctorNote
from naderk.messaging.models import Conversation, ConversationStatus
from naderk.messaging.selectors import get_unread_message_count
from naderk.telehealth.models import TelehealthSession
from naderk.ecommerce.models import Order, Prescription
from datetime import timedelta, date

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


class AdminDashboardSummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.role not in ('ADMIN', 'SUPER_ADMIN'):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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

        # --- Appointment queue: today's non-cancelled confirmed+ ---
        queue_qs = Appointment.objects.filter(
            appointment_date=today
        ).exclude(
            status__in=[Appointment.Status.CANCELLED, Appointment.Status.PENDING]
        ).order_by('appointment_time').select_related('patient', 'service')[:20]

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

def _admin_only(request):
    return request.user.role not in ('ADMIN', 'SUPER_ADMIN')


class AdminAppointmentRequestsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

        qs = (
            Appointment.objects.filter(status=Appointment.Status.PENDING)
            .exclude(
                payment_status=Appointment.PaymentStatus.PENDING,
                consultation_fee__gt=0,
            )
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

        import datetime as dt
        from naderk.core.models import User as UserModel

        try:
            appt = Appointment.objects.select_related('patient').get(id=pk, status=Appointment.Status.PENDING)
        except Appointment.DoesNotExist:
            return build_success_response(message="Appointment not found or not pending.", data={}, status_code=404, success=False)

        doctor_id = request.data.get('doctor_id')
        new_date = request.data.get('date')
        new_time = request.data.get('time')

        if not all([doctor_id, new_date, new_time]):
            return build_success_response(message="doctor_id, date and time are required.", data={}, status_code=400, success=False)

        try:
            doctor = UserModel.objects.get(id=doctor_id, role='DOCTOR')
        except UserModel.DoesNotExist:
            return build_success_response(message="Doctor not found.", data={}, status_code=404, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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
                "specialization": p.get_specialization_display(),
            }
            for p in profiles
        ]
        return build_success_response(message="Doctors retrieved.", data=results, status_code=200)


# ─── Admin Inventory APIs ──────────────────────────────────────────────────────

class AdminInventorySummaryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

        from naderk.ecommerce.models import Product
        products = Product.objects.filter(is_active=True).select_related('category')

        total_stock = products.aggregate(t=Sum('quantity_available'))['t'] or 0
        category_count = products.values('category').distinct().count()

        by_category = list(
            products.values('category__name')
            .annotate(total=Sum('quantity_available'))
            .order_by('-total')
        )

        low_stock = list(
            products.filter(quantity_available__lt=15)
            .order_by('quantity_available')
            .values('id', 'name', 'quantity_available', 'category__name')[:10]
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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

        products = (
            Product.objects.select_related('category')
            .order_by('category__name', 'name')
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
                'low_stock': p.quantity_available < 15,
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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
            return build_success_response(
                message="name, description, category_id and price are required.",
                data={}, status_code=400, success=False
            )

        try:
            category = StoreCategory.objects.get(id=category_id)
        except StoreCategory.DoesNotExist:
            return build_success_response(message="Category not found.", data={}, status_code=404, success=False)

        image_urls = []
        for key in ['image_0', 'image_1', 'image_2', 'image_3', 'image_4']:
            file = request.FILES.get(key)
            if file:
                try:
                    result = storage_service.upload_file(file, bucket_type='public', prefix='products', uploaded_by=request.user)
                    image_urls.append(result.url)
                except Exception:
                    pass

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_success_response(message="Product not found.", data={}, status_code=404, success=False)

        quantity = int(request.data.get('quantity', 0))
        if quantity <= 0:
            return build_success_response(message="Quantity must be positive.", data={}, status_code=400, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_success_response(message="Product not found.", data={}, status_code=404, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.prefetch_related('variants').select_related('category').get(id=pk)
        except Product.DoesNotExist:
            return build_success_response(message="Not found.", data={}, status_code=404, success=False)
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import Product, StoreCategory
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_success_response(message="Not found.", data={}, status_code=404, success=False)
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
                return build_success_response(message="Category not found.", data={}, status_code=400, success=False)
        product.save()
        return build_success_response(message="Product updated.", data={'id': str(product.id)}, status_code=200)

    def delete(self, request, pk):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import Product
        try:
            product = Product.objects.get(id=pk)
        except Product.DoesNotExist:
            return build_success_response(message="Not found.", data={}, status_code=404, success=False)
        product.delete()
        return build_success_response(message="Product deleted.", data={}, status_code=200)


class AdminProductHistoryAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import StoreCategory
        from django.utils.text import slugify
        name = (request.data.get('name') or '').strip()
        if not name:
            return build_success_response(message="Name is required.", data={}, status_code=400, success=False)
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import StoreCategory
        try:
            cat = StoreCategory.objects.get(id=pk)
        except StoreCategory.DoesNotExist:
            return build_success_response(message="Category not found.", data={}, status_code=404, success=False)
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import StoreCategory
        try:
            cat = StoreCategory.objects.get(id=pk)
        except StoreCategory.DoesNotExist:
            return build_success_response(message="Category not found.", data={}, status_code=404, success=False)
        if cat.products.exists():
            return build_success_response(
                message="Cannot delete a category that has products.", data={}, status_code=400, success=False
            )
        cat.delete()
        return build_success_response(message="Category deleted.", data={}, status_code=200)


# ── Flash Sale Management ─────────────────────────────────────────────────────

class AdminFlashSaleListAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import FlashSale, Product
        name = (request.data.get('name') or '').strip()
        discount_percent = request.data.get('discount_percent')
        starts_at = request.data.get('starts_at')
        ends_at = request.data.get('ends_at')
        product_ids = request.data.get('product_ids', [])

        if not all([name, discount_percent, starts_at, ends_at]):
            return build_success_response(
                message="name, discount_percent, starts_at, ends_at are required.",
                data={}, status_code=400, success=False
            )
        try:
            discount_percent = float(discount_percent)
            if not (0 < discount_percent <= 100):
                raise ValueError
        except (ValueError, TypeError):
            return build_success_response(message="discount_percent must be between 1 and 100.", data={}, status_code=400, success=False)

        from django.utils.dateparse import parse_datetime
        starts = parse_datetime(starts_at)
        ends = parse_datetime(ends_at)
        if not starts or not ends or ends <= starts:
            return build_success_response(message="Invalid date range.", data={}, status_code=400, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import FlashSale, Product
        try:
            sale = FlashSale.objects.get(id=pk)
        except FlashSale.DoesNotExist:
            return build_success_response(message="Flash sale not found.", data={}, status_code=404, success=False)
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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.ecommerce.models import FlashSale
        try:
            sale = FlashSale.objects.get(id=pk)
        except FlashSale.DoesNotExist:
            return build_success_response(message="Flash sale not found.", data={}, status_code=404, success=False)
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
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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
            department = (profile.department if profile else None) or (doc.get_specialization_display() if doc else u.get_role_display())
            job_title = doc.get_specialization_display() if doc else u.get_role_display()

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
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

        from naderk.core.models import User
        from naderk.users.models import StaffProfile
        import secrets

        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        email = (request.data.get('email') or '').strip().lower()
        role = (request.data.get('role') or '').strip()
        phone = (request.data.get('phone_number') or '').strip()
        department = (request.data.get('department') or '').strip()
        employee_id = (request.data.get('employee_id') or '').strip()

        if not all([first_name, email, role]):
            return build_success_response(
                message="first_name, email, and role are required.",
                data={}, status_code=400, success=False
            )
        if User.objects.filter(email=email).exists():
            return build_success_response(message="A user with this email already exists.", data={}, status_code=400, success=False)

        temp_password = secrets.token_urlsafe(12)
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            role=role,
            is_active=True,
            is_verified=True,
        )
        if phone:
            user.phone_number = phone
        user.set_password(temp_password)
        user.username = email
        user.save()

        StaffProfile.objects.create(
            user=user,
            employee_id=employee_id or f"NDK{str(user.id).replace('-','')[:5].upper()}",
            department=department,
        )

        return build_success_response(
            message="Staff member created.",
            data={
                'id': str(user.id),
                'name': f"{user.first_name} {user.last_name}".strip(),
                'temp_password': temp_password,
            },
            status_code=201
        )


class AdminStaffToggleAPI(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

        from naderk.core.models import User
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return build_success_response(message="User not found.", data={}, status_code=404, success=False)

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
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)

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
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.users.models import Department
        depts = Department.objects.filter(is_active=True)
        data = [{'id': str(d.id), 'name': d.name, 'description': d.description or ''} for d in depts]
        return build_success_response(message="Departments retrieved.", data=data, status_code=200)

    def post(self, request):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.users.models import Department
        name = (request.data.get('name') or '').strip()
        if not name:
            return build_success_response(message="Name is required.", data={}, status_code=400, success=False)
        if Department.objects.filter(name__iexact=name).exists():
            return build_success_response(message="Department already exists.", data={}, status_code=400, success=False)
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
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.users.models import Department
        try:
            dept = Department.objects.get(id=pk)
        except Department.DoesNotExist:
            return build_success_response(message="Not found.", data={}, status_code=404, success=False)
        if 'name' in request.data:
            dept.name = request.data['name'].strip()
        if 'description' in request.data:
            dept.description = request.data['description'].strip() or None
        dept.save()
        return build_success_response(message="Department updated.", data={'id': str(dept.id), 'name': dept.name}, status_code=200)

    def delete(self, request, pk):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.users.models import Department
        try:
            dept = Department.objects.get(id=pk)
        except Department.DoesNotExist:
            return build_success_response(message="Not found.", data={}, status_code=404, success=False)
        dept.is_active = False
        dept.save(update_fields=['is_active'])
        return build_success_response(message="Department removed.", data={}, status_code=200)


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

MANAGEABLE_ROLES = ['DOCTOR', 'OPTICIAN', 'MEDICAL_AGENT', 'ADMIN']


class AdminPermissionsAPI(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _admin_only(request):
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
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
            return build_success_response(message="Forbidden.", data={}, status_code=403, success=False)
        from naderk.users.models import RolePermissionConfig
        role = (request.data.get('role') or '').strip()
        permissions = request.data.get('permissions', [])
        if role not in MANAGEABLE_ROLES:
            return build_success_response(message="Invalid role.", data={}, status_code=400, success=False)
        valid_ids = {p['id'] for p in SYSTEM_PERMISSIONS}
        clean_perms = [p for p in permissions if p in valid_ids]
        config, _ = RolePermissionConfig.objects.get_or_create(role=role, defaults={'permissions': []})
        config.permissions = clean_perms
        config.save()
        return build_success_response(message="Permissions updated.", data={'role': role, 'permissions': clean_perms}, status_code=200)
