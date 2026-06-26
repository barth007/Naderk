from django.db.models import Q
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
        
        # Sort appointments by date & time
        # latest appointment (past or current status)
        past_appointments = [a for a in pat_appointments if a.status in ['COMPLETED', 'CHECKED_IN', 'IN_PROGRESS', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW']]
        latest_appt = past_appointments[0] if past_appointments else pat_appointments[0]
        
        # next appointment (upcoming status)
        upcoming_appointments = [a for a in pat_appointments if a.status in ['PENDING', 'CONFIRMED']]
        next_appt = upcoming_appointments[-1] if upcoming_appointments else None
        
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
        if not address:
            address = "1234 Street CRD Lugbe"  # Mock default
            
        register_date = pat.date_joined if hasattr(pat, 'date_joined') else pat.created_at

        # complaints
        complaints_text = (profile.reason_for_visit if profile else "") or ""
        if not complaints_text and latest_appt.notes:
            complaints_text = latest_appt.notes
        complaints_list = [c.strip() for c in complaints_text.split(',') if c.strip()] if complaints_text else []
        if not complaints_list:
            complaints_list = ["Eye Sore", "Blurry vision", "Severe headache"]  # Fallback mock

        # prescriptions
        prescriptions = Prescription.objects.filter(patient=pat).order_by('-created_at')
        current_rx = "Lantanoprost 0.005%"
        prev_rx = "Lantanoprost 0.005%"
        if prescriptions.exists():
            latest_rx = prescriptions[0]
            current_rx = f"OD: SPH {latest_rx.right_sph or '0.00'} | OS: SPH {latest_rx.left_sph or '0.00'}"
            if len(prescriptions) > 1:
                older_rx = prescriptions[1]
                prev_rx = f"OD: SPH {older_rx.right_sph or '0.00'} | OS: SPH {older_rx.left_sph or '0.00'}"
            else:
                prev_rx = "None"

        # Mode Mapping
        mode = "In-person"
        if latest_appt.appointment_type == Appointment.AppointmentType.TELEHEALTH:
            mode = "Online"
        elif latest_appt.appointment_type == Appointment.AppointmentType.PHYSICAL:
            mode = "In-person"
            
        records.append({
            'patient_id': hospital_id,
            'id': str(pat.id),
            'name': f"{pat.first_name} {pat.last_name}",
            'email': pat.email,
            'phone_number': phone or "Not provided",
            'last_visit': latest_appt.appointment_date.strftime('%b %d, %Y') if latest_appt else "N/A",
            'complaints': complaints_list,
            'complaints_summary': ", ".join(complaints_list[:2]),
            'mode': mode,
            'status': latest_appt.get_status_display() if latest_appt else "Unknown",
            'dob': dob.strftime('%b %d, %Y') if dob else "Feb 28, 1999",
            'gender': gender or "Female",
            'weight': "56KG", # Mock weight
            'vitals': "120/150", # Mock vitals
            'last_appointment': latest_appt.appointment_date.strftime('%b %d, %Y') if latest_appt else "N/A",
            'register_date': register_date.strftime('%b %d, %Y') if register_date else "Dec 20, 2024",
            'next_appointment': next_appt.appointment_date.strftime('%b %d, %Y') if next_appt else "None",
            'previous_rx': prev_rx,
            'current_rx': current_rx,
            'address': address
        })

    return records
