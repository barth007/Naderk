"""
Who counts as staff in messaging, and who may enter a conversation.

These rules used to be spelled out inline in nine places as
`role in [AGENT, DOCTOR, ADMIN]`, which left MEDICAL_AGENT and SUPER_ADMIN
able to list and assign conversations but not open them, and left the
WebSocket with no check at all.
"""
from django.contrib.auth import get_user_model

User = get_user_model()

#: Roles that work the support queue: they triage, assign and answer.
TRIAGE_ROLES = frozenset({
    User.Role.AGENT, User.Role.MEDICAL_AGENT, User.Role.ADMIN, User.Role.SUPER_ADMIN,
})

#: Everyone on the care-team side of a conversation.
STAFF_ROLES = TRIAGE_ROLES | {User.Role.DOCTOR}


def is_messaging_staff(user) -> bool:
    return getattr(user, 'role', None) in STAFF_ROLES


def can_access_conversation(user, conversation) -> bool:
    """Staff, the patient the conversation belongs to, or a registered participant."""
    if is_messaging_staff(user):
        return True
    if conversation.patient_id == user.id:
        return True
    return conversation.participants.filter(user=user).exists()
