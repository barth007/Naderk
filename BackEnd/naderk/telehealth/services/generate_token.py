from django.conf import settings
from livekit.api import AccessToken, VideoGrants

def generate_livekit_token(*, session, user) -> str:
    """
    Generates a LiveKit JWT token for a given session and user.

    A consultation is between the patient and their doctor: nobody else is
    issued a token, whatever their role.
    """
    appointment = session.appointment
    if user.id not in (appointment.patient_id, appointment.doctor_id):
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
