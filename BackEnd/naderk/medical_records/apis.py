from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.shortcuts import get_object_or_404
from django.db.models import Q
from django.http import FileResponse
from io import BytesIO
from decimal import Decimal

# ReportLab imports
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

from naderk.common.responses.builders import build_success_response, build_error_response
from naderk.core.models import User
from naderk.ecommerce.models import Prescription
from naderk.ecommerce.serializers import PrescriptionSerializer

from .models import ConsultationEncounter, DiagnosticResult, MedicalScan, Medication
from .serializers import (
    ConsultationEncounterSerializer,
    ConsultationEncounterDetailSerializer,
    MedicationSerializer,
    MedicationCreateSerializer,
    DiagnosticResultSerializer,
    MedicalScanSerializer
)
from .permissions import IsRecordOwnerOrDoctorWithActiveAppointment
from .selectors import get_doctor_patient_records


class PatientRecordsListApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Access control: only clinical staff (doctor, agent, admin)
        if request.user.role not in ['DOCTOR', 'AGENT', 'MEDICAL_AGENT', 'ADMIN', 'SUPER_ADMIN']:
            return build_error_response(
                "forbidden", 
                "Access Denied", 
                403, 
                "You are not authorized to view patient records."
            )
            
        search_query = request.query_params.get('q', '').strip()
        records = get_doctor_patient_records(user=request.user, search_query=search_query)
        
        return build_success_response("Patient records retrieved successfully", records)


class MedicalRecordsPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return build_success_response(
            message="Data retrieved successfully",
            data={
                "count": self.page.paginator.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data
            }
        )


class PatientMedicalRecordsOverviewApi(APIView):
    permission_classes = [IsAuthenticated, IsRecordOwnerOrDoctorWithActiveAppointment]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        
        if not patient_id:
            if request.user.role == 'PATIENT':
                patient = request.user
            else:
                return build_error_response(
                    "bad_request",
                    "Patient ID is required.",
                    400
                )
        else:
            patient = get_object_or_404(User, id=patient_id)
            
        # Compile patient demographic details
        profile = getattr(patient, 'patient_profile', None)
        dob_str = None
        dob = patient.date_of_birth or (profile.dob if profile else None)
        if dob:
            if isinstance(dob, str):
                dob_str = dob
            else:
                dob_str = dob.strftime('%Y-%m-%d')
            
        patient_info = {
            'id': str(patient.id),
            'name': f"{patient.first_name} {patient.last_name}".strip() or patient.email,
            'email': patient.email,
            'phone_number': patient.phone_number or (profile.phone_number if profile else None) or "Not provided",
            'dob': dob_str,
            'gender': patient.gender or (profile.gender if profile else None) or "Not specified",
            'patient_id': (profile.patient_id if (profile and profile.patient_id) else f"NDK-{str(patient.id)[:6].upper()}"),
            'address': (profile.address if profile else "") or ""
        }

        # Fetch limited records for overview
        encounters = ConsultationEncounter.objects.filter(patient=patient)[:5]
        active_medications = Medication.objects.filter(patient=patient, status='ACTIVE')
        diagnostics = DiagnosticResult.objects.filter(patient=patient)[:5]
        scans = MedicalScan.objects.filter(patient=patient)[:5]
        eyewear_prescriptions = Prescription.objects.filter(patient=patient)[:5]

        data = {
            'patient_info': patient_info,
            'recent_encounters': ConsultationEncounterSerializer(encounters, many=True).data,
            'active_medications': MedicationSerializer(active_medications, many=True).data,
            'recent_diagnostics': DiagnosticResultSerializer(diagnostics, many=True).data,
            'recent_scans': MedicalScanSerializer(scans, many=True).data,
            'eyewear_prescriptions': PrescriptionSerializer(eyewear_prescriptions, many=True).data
        }

        return build_success_response("Medical records overview retrieved successfully", data)


class EncounterListApi(APIView):
    permission_classes = [IsAuthenticated, IsRecordOwnerOrDoctorWithActiveAppointment]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            if request.user.role == 'PATIENT':
                patient_id = request.user.id
            else:
                return build_error_response("bad_request", "Patient ID is required.", 400)

        queryset = ConsultationEncounter.objects.filter(patient_id=patient_id)

        # Search filter
        search_query = request.query_params.get('search') or request.query_params.get('q')
        if search_query:
            search_query = search_query.strip()
            queryset = queryset.filter(
                Q(diagnosis__icontains=search_query) |
                Q(notes__icontains=search_query) |
                Q(reference_number__icontains=search_query) |
                Q(appointment__notes__icontains=search_query) |
                Q(clinical_findings__icontains=search_query)
            )

        paginator = MedicalRecordsPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        serializer = ConsultationEncounterSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)


class EncounterDetailApi(APIView):
    permission_classes = [IsAuthenticated, IsRecordOwnerOrDoctorWithActiveAppointment]

    def get(self, request, pk):
        encounter = get_object_or_404(ConsultationEncounter, id=pk)
        self.check_object_permissions(request, encounter)
        serializer = ConsultationEncounterDetailSerializer(encounter)
        return build_success_response("Consultation encounter details retrieved", serializer.data)


class PrescriptionListApi(APIView):
    permission_classes = [IsAuthenticated, IsRecordOwnerOrDoctorWithActiveAppointment]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            if request.user.role == 'PATIENT':
                patient_id = request.user.id
            else:
                return build_error_response("bad_request", "Patient ID is required.", 400)

        queryset = Prescription.objects.filter(patient_id=patient_id)
        paginator = MedicalRecordsPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        serializer = PrescriptionSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)


class DiagnosticResultListApi(APIView):
    permission_classes = [IsAuthenticated, IsRecordOwnerOrDoctorWithActiveAppointment]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            if request.user.role == 'PATIENT':
                patient_id = request.user.id
            else:
                return build_error_response("bad_request", "Patient ID is required.", 400)

        queryset = DiagnosticResult.objects.filter(patient_id=patient_id)
        paginator = MedicalRecordsPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        serializer = DiagnosticResultSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)


class MedicalScanListApi(APIView):
    permission_classes = [IsAuthenticated, IsRecordOwnerOrDoctorWithActiveAppointment]

    def get(self, request):
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            if request.user.role == 'PATIENT':
                patient_id = request.user.id
            else:
                return build_error_response("bad_request", "Patient ID is required.", 400)

        queryset = MedicalScan.objects.filter(patient_id=patient_id)
        paginator = MedicalRecordsPagination()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        serializer = MedicalScanSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)


class MedicationListCreateApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        patient_id = request.query_params.get('patient_id')
        encounter_id = request.query_params.get('encounter_id')

        if user.role == 'DOCTOR':
            qs = Medication.objects.filter(prescribed_by=user)
            if patient_id:
                qs = qs.filter(patient_id=patient_id)
            if encounter_id:
                qs = qs.filter(encounter_id=encounter_id)
        else:
            qs = Medication.objects.filter(patient=user)
            if encounter_id:
                qs = qs.filter(encounter_id=encounter_id)

        serializer = MedicationSerializer(qs, many=True)
        return build_success_response("Medications retrieved.", serializer.data)

    def post(self, request):
        if request.user.role != 'DOCTOR':
            return build_error_response("forbidden", "Permission denied", 403, "Only doctors can issue medication prescriptions.")
        serializer = MedicationCreateSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return build_error_response("validation-error", "Invalid data", 400, "Validation failed.", errors=serializer.errors)
        medication = serializer.save()
        from rest_framework import status as drf_status
        from rest_framework.response import Response
        return Response({"status": "success", "message": "Medication created.", "data": MedicationSerializer(medication).data}, status=drf_status.HTTP_201_CREATED)


class MedicationDetailApi(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        if user.role == 'DOCTOR':
            med = get_object_or_404(Medication, id=pk, prescribed_by=user)
        else:
            med = get_object_or_404(Medication, id=pk, patient=user)
        return build_success_response("Medication retrieved.", MedicationSerializer(med).data)

    def delete(self, request, pk):
        if request.user.role != 'DOCTOR':
            return build_error_response("forbidden", "Permission denied", 403, "Only doctors can delete medications.")
        med = get_object_or_404(Medication, id=pk, prescribed_by=request.user)
        med.delete()
        return build_success_response("Medication deleted.", {'deleted': True})


class PrescriptionPdfApi(APIView):
    permission_classes = [IsAuthenticated, IsRecordOwnerOrDoctorWithActiveAppointment]

    def get(self, request, pk):
        prescription = get_object_or_404(Prescription, id=pk)
        self.check_object_permissions(request, prescription)
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=40,
            leftMargin=40,
            topMargin=40,
            bottomMargin=40
        )
        
        story = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'TitleStyle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#0f172a'),
            spaceAfter=15,
            alignment=1
        )
        
        subtitle_style = ParagraphStyle(
            'SubtitleStyle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#475569'),
            spaceAfter=30,
            alignment=1
        )
        
        heading_style = ParagraphStyle(
            'HeadingStyle',
            parent=styles['Heading2'],
            fontSize=14,
            textColor=colors.HexColor('#0f172a'),
            spaceBefore=15,
            spaceAfter=10
        )
        
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.HexColor('#1e293b'),
            leading=14
        )
        
        story.append(Paragraph("NADERK EYE CLINIC", title_style))
        story.append(Paragraph("Official Eyewear Prescription Document", subtitle_style))
        
        patient_name = f"{prescription.patient.first_name} {prescription.patient.last_name}".strip() or prescription.patient.email
        doctor_name = "N/A"
        doctor_specialty = "Optician/Doctor"
        
        if prescription.encounter:
            doctor_name = f"Dr. {prescription.encounter.doctor.first_name} {prescription.encounter.doctor.last_name}"
            try:
                doctor_specialty = prescription.encounter.doctor.doctor_profile.specialization
            except Exception:
                doctor_specialty = "General Practitioner"
        elif prescription.patient.appointments_as_patient.filter(status='COMPLETED').exists():
            last_appt = prescription.patient.appointments_as_patient.filter(status='COMPLETED').order_by('-appointment_date').first()
            if last_appt:
                doctor_name = f"Dr. {last_appt.doctor.first_name} {last_appt.doctor.last_name}"
                try:
                    doctor_specialty = last_appt.doctor.doctor_profile.specialization
                except Exception:
                    doctor_specialty = "General Practitioner"

        info_data = [
            [
                Paragraph(f"<b>Patient:</b> {patient_name}", body_style),
                Paragraph(f"<b>Prescribed By:</b> {doctor_name}", body_style)
            ],
            [
                Paragraph(f"<b>Email:</b> {prescription.patient.email}", body_style),
                Paragraph(f"<b>Specialization:</b> {doctor_specialty}", body_style)
            ],
            [
                Paragraph(f"<b>Date Issued:</b> {prescription.created_at.strftime('%b %d, %Y')}", body_style),
                Paragraph(f"<b>Expiry Date:</b> {prescription.expires_at.strftime('%b %d, %Y') if prescription.expires_at else 'N/A'}", body_style)
            ],
            [
                Paragraph(f"<b>Prescription ID:</b> {str(prescription.id)[:8].upper()}", body_style),
                Paragraph(f"<b>Status:</b> {prescription.get_status_display()}", body_style)
            ]
        ]
        
        info_table = Table(info_data, colWidths=[260, 260])
        info_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('PADDING', (0,0), (-1,-1), 8),
            ('LINEBELOW', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0,0), (-1,-1), 0.25, colors.HexColor('#e2e8f0')),
        ]))
        
        story.append(info_table)
        story.append(Spacer(1, 25))
        
        story.append(Paragraph("Clinical Refraction Details", heading_style))
        
        rx_header_style = ParagraphStyle(
            'RxHeaderStyle',
            parent=styles['Normal'],
            fontSize=10,
            textColor=colors.white,
            fontName='Helvetica-Bold',
            alignment=1
        )
        rx_cell_style = ParagraphStyle(
            'RxCellStyle',
            parent=styles['Normal'],
            fontSize=10,
            alignment=1
        )
        
        def format_val(val):
            if val is None:
                return "-"
            if isinstance(val, (int, float, Decimal)):
                if val > 0:
                    return f"+{val:.2f}"
                return f"{val:.2f}"
            return str(val)

        rx_data = [
            [
                Paragraph("<b>Eye</b>", rx_header_style),
                Paragraph("<b>Sphere (SPH)</b>", rx_header_style),
                Paragraph("<b>Cylinder (CYL)</b>", rx_header_style),
                Paragraph("<b>Axis</b>", rx_header_style),
                Paragraph("<b>Add</b>", rx_header_style),
            ],
            [
                Paragraph("<b>OD</b> (Right Eye)", rx_cell_style),
                Paragraph(format_val(prescription.right_sph), rx_cell_style),
                Paragraph(format_val(prescription.right_cyl), rx_cell_style),
                Paragraph(str(prescription.right_axis) if prescription.right_axis is not None else "-", rx_cell_style),
                Paragraph(format_val(prescription.right_add), rx_cell_style),
            ],
            [
                Paragraph("<b>OS</b> (Left Eye)", rx_cell_style),
                Paragraph(format_val(prescription.left_sph), rx_cell_style),
                Paragraph(format_val(prescription.left_cyl), rx_cell_style),
                Paragraph(str(prescription.left_axis) if prescription.left_axis is not None else "-", rx_cell_style),
                Paragraph(format_val(prescription.left_add), rx_cell_style),
            ]
        ]
        
        rx_table = Table(rx_data, colWidths=[120, 100, 100, 100, 100])
        rx_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 10),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')])
        ]))
        
        story.append(rx_table)
        story.append(Spacer(1, 20))
        
        pd_data = [
            [
                Paragraph("<b>Pupillary Distance (PD)</b>", rx_cell_style),
                Paragraph(f"{prescription.pupillary_distance} mm", rx_cell_style),
                Paragraph("<b>Near PD</b>", rx_cell_style),
                Paragraph(f"{prescription.near_pd} mm" if prescription.near_pd else "-", rx_cell_style),
            ],
            [
                Paragraph("<b>Segment Height</b>", rx_cell_style),
                Paragraph(f"{prescription.segment_height} mm" if prescription.segment_height else "-", rx_cell_style),
                Paragraph("<b>Fitting Height</b>", rx_cell_style),
                Paragraph(f"{prescription.fitting_height} mm" if prescription.fitting_height else "-", rx_cell_style),
            ]
        ]
        
        pd_table = Table(pd_data, colWidths=[150, 110, 150, 110])
        pd_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('PADDING', (0,0), (-1,-1), 8),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ('BACKGROUND', (0,0), (0,-1), colors.HexColor('#f1f5f9')),
            ('BACKGROUND', (2,0), (2,-1), colors.HexColor('#f1f5f9')),
        ]))
        
        story.append(pd_table)
        story.append(Spacer(1, 40))
        
        disclaimer_style = ParagraphStyle(
            'DisclaimerStyle',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#64748b'),
            leading=11
        )
        
        story.append(Paragraph("This optical prescription is clinically validated by Naderk Eye Clinic. Please present this document during frame and lens selection. Keep a copy for your records.", disclaimer_style))
        story.append(Spacer(1, 50))
        
        sig_data = [
            ["", "_____________________________________"],
            ["", "Authorized Clinical Signature"]
        ]
        sig_table = Table(sig_data, colWidths=[300, 220])
        sig_table.setStyle(TableStyle([
            ('ALIGN', (1,0), (1,-1), 'CENTER'),
            ('FONTNAME', (1,1), (1,1), 'Helvetica-Bold'),
            ('FONTSIZE', (1,1), (1,1), 9),
            ('TEXTCOLOR', (1,1), (1,1), colors.HexColor('#475569')),
        ]))
        story.append(sig_table)
        
        doc.build(story)
        buffer.seek(0)
        
        response = FileResponse(buffer, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="prescription_{prescription.id}.pdf"'
        return response
