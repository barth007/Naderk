from django.conf import settings
from livekit.api import AccessToken, VideoGrants

def generate_livekit_token(*, session, user) -> str:
    """
    Generates a LiveKit JWT token for a given session and user.
    Enforces that the user is the patient, doctor, or authorized medical staff.
    """
    appointment = session.appointment
    is_patient = (user.id == appointment.patient.id)
    is_doctor = (user.id == appointment.doctor.id)
    is_staff = user.role in ['AGENT', 'ADMIN']

    if not (is_patient or is_doctor or is_staff):
        raise PermissionError("Access Denied: You are not authorized to join this session.")

    api_key = getattr(settings, 'LIVEKIT_API_KEY', 'devkey')
    api_secret = getattr(settings, 'LIVEKIT_API_SECRET', 'secretkey')

    token = AccessToken(api_key, api_secret)
    token.with_identity(str(user.id))
    
    display_name = f"{user.first_name} {user.last_name}".strip() or user.email
    token.with_name(display_name)
    
    # Grants
    grants = VideoGrants(
        room_join=True,
        room=session.room_name,
    )
    token.with_grants(grants)
    
    return token.to_jwt()
