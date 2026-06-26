from django.db.models import Q
from naderk.telehealth.models import TelehealthSession

def get_user_sessions(*, user):
    """
    Returns telehealth sessions associated with the user, grouped by status:
    - active: sessions currently in progress
    - upcoming: sessions scheduled, ready, or waiting
    - past: completed, cancelled, or missed sessions
    """
    from naderk.core.models import User
    if user.role in [User.Role.MEDICAL_AGENT, User.Role.AGENT, User.Role.ADMIN, User.Role.SUPER_ADMIN]:
        base_query = TelehealthSession.objects.all().select_related('appointment', 'appointment__patient', 'appointment__doctor', 'appointment__service')
    else:
        base_query = TelehealthSession.objects.filter(
            Q(appointment__patient=user) | Q(appointment__doctor=user)
        ).select_related('appointment', 'appointment__patient', 'appointment__doctor', 'appointment__service')
    
    active = base_query.filter(status=TelehealthSession.Status.ACTIVE).order_by('scheduled_start')
    
    upcoming = base_query.filter(
        status__in=[
            TelehealthSession.Status.SCHEDULED,
            TelehealthSession.Status.WAITING_ROOM,
            TelehealthSession.Status.WAITING_FOR_DOCTOR
        ]
    ).order_by('scheduled_start')
    
    past = base_query.filter(
        status__in=[
            TelehealthSession.Status.COMPLETED,
            TelehealthSession.Status.CANCELLED,
            TelehealthSession.Status.MISSED
        ]
    ).order_by('-scheduled_start')
    
    return {
        'active': active,
        'upcoming': upcoming,
        'past': past
    }
