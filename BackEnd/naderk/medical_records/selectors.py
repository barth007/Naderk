from django.db.models import Q
from django.utils import timezone
from naderk.appointments.models import Appointment
from naderk.ecommerce.models import Prescription
from naderk.users.models import PatientProfile
from django.contrib.auth import get_user_model

User = get_user_model()

def get_doctor_patient_records(*, user, search_query=""):
    """
    Returns patient records associated with the doctor or all patients for agents/admins,
    optionally filtered by search_query matching name, email, or hospital patient_id.
    """
    # Base appointments query
    if user.role == User.Role.DOCTOR:
        base_query = Appointment.objects.filter(doctor=user)
    else:
        # Agents/Admins see all records
        base_query = Appointment.objects.all()

    # Pre-select related objects for performance
    base_query = base_query.select_related(
        'patient', 
        'patient__patient_profile', 
        'service'
    ).order_by('-appointment_date', '-appointment_time')

    # Apply search query if present
    if search_query:
        base_query = base_query.filter(
            Q(patient__first_name__icontains=search_query) |
            Q(patient__last_name__icontains=search_query) |
            Q(patient__email__icontains=search_query) |
            Q(patient__patient_profile__patient_id__icontains=search_query)
        )

    # Group by patient
    patient_map = {}
    for appt in base_query:
        pat = appt.patient
        if pat.id not in patient_map:
            patient_map[pat.id] = {
                'patient': pat,
                'appointments': []
            }
        patient_map[pat.id]['appointments'].append(appt)

    records = []
    for pat_id, data in patient_map.items():
        pat = data['patient']
        pat_appointments = data['appointments']
        
        # The list was never actually sorted despite the old comment saying so,
        # and "last" fell back to *any* appointment when there was no past visit
        # — which is how a future date ended up displayed as the last visit while
        # today's booking showed as the next one.
        today = timezone.now().date()
        pat_appointments = sorted(
            pat_appointments, key=lambda a: (a.appointment_date, a.appointment_time)
        )

        # Last visit = the most recent appointment that has actually happened.
        # A cancelled booking is not a visit, and a future date can never be one.
        attended_statuses = ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS', 'NO_SHOW']
        past_appointments = [
            a for a in pat_appointments
            if a.status in attended_statuses and a.appointment_date <= today
        ]
        latest_appt = past_appointments[-1] if past_appointments else None

        # Next = the soonest upcoming booking, not the furthest away.
        upcoming_appointments = [
            a for a in pat_appointments
            if a.status in ['PENDING', 'CONFIRMED'] and a.appointment_date >= today
        ]
        next_appt = upcoming_appointments[0] if upcoming_appointments else None

        # Everything below that reads `latest_appt` must tolerate a patient who
        # has booked but never yet been seen.
        reference_appt = latest_appt or next_appt or (pat_appointments[0] if pat_appointments else None)
        
        # profile
        profile = getattr(pat, 'patient_profile', None)
        hospital_id = profile.patient_id if (profile and profile.patient_id) else f"NDK-{str(pat.id)[:6].upper()}"
        dob = pat.date_of_birth or (profile.dob if profile else None)
        gender = pat.gender or (profile.gender if profile else None)
        phone = pat.phone_number or (profile.phone_number if profile else None)
        
        address = ""
        if profile:
            address_parts = [profile.address, profile.city, profile.state]
            address = ", ".join(filter(None, address_parts))
        # No invented address — the UI shows a placeholder when this is blank.
        address = address or None
            
        register_date = pat.date_joined if hasattr(pat, 'date_joined') else pat.created_at

        # complaints
        complaints_text = (profile.reason_for_visit if profile else "") or ""
        if not complaints_text and reference_appt and reference_appt.notes:
            complaints_text = reference_appt.notes
        # Previously fell back to a canned list of symptoms, which put
        # complaints the patient never reported into their clinical record.
        complaints_list = [c.strip() for c in complaints_text.split(',') if c.strip()] if complaints_text else []

        # prescriptions
        # A patient with no prescription must show none. This used to default to
        # a real drug name and dosage, so every patient without a prescription
        # appeared — to both doctors and admins — to be on Lantanoprost 0.005%.
        prescriptions = Prescription.objects.filter(patient=pat).order_by('-created_at')
        current_rx = None
        prev_rx = None
        if prescriptions.exists():
            latest_rx = prescriptions[0]
            current_rx = f"OD: SPH {latest_rx.right_sph or '0.00'} | OS: SPH {latest_rx.left_sph or '0.00'}"
            if len(prescriptions) > 1:
                older_rx = prescriptions[1]
                prev_rx = f"OD: SPH {older_rx.right_sph or '0.00'} | OS: SPH {older_rx.left_sph or '0.00'}"
            else:
                prev_rx = None

        # Mode Mapping
        mode = None
        if reference_appt:
            mode = "Online" if reference_appt.appointment_type == Appointment.AppointmentType.TELEHEALTH else "In-person"
            
        records.append({
            'patient_id': hospital_id,
            'id': str(pat.id),
            'name': f"{pat.first_name} {pat.last_name}",
            'email': pat.email,
            'phone_number': phone or "Not provided",
            'last_visit': latest_appt.appointment_date.strftime('%b %d, %Y') if latest_appt else None,
            'complaints': complaints_list,
            'complaints_summary': ", ".join(complaints_list[:2]),
            'mode': mode,
            'status': reference_appt.get_status_display() if reference_appt else None,
            'dob': dob.strftime('%b %d, %Y') if dob else None,
            'gender': gender or None,
            # Vitals are not captured anywhere yet; inventing them put fake
            # clinical readings in front of doctors. Null until real data exists.
            'weight': None,
            'vitals': None,
            'last_appointment': latest_appt.appointment_date.strftime('%b %d, %Y') if latest_appt else None,
            'register_date': register_date.strftime('%b %d, %Y') if register_date else None,
            'next_appointment': next_appt.appointment_date.strftime('%b %d, %Y') if next_appt else None,
            'previous_rx': prev_rx,
            'current_rx': current_rx,
            'address': address,
            # Exposed so the admin Patient Records filters have real values to
            # work with — "Department" previously filtered on the complaints
            # string and "Insurance" had no data behind it at all.
            'service_name': reference_appt.service.name if (reference_appt and reference_appt.service) else None,
            'insurance_provider': (profile.insurance_provider if profile else None) or None
        })

    return records
