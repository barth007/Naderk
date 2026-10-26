from naderk.core.models import User
from naderk.users.models import DoctorProfile


def _make_doctor(email, *, specialization, telehealth, accepting=True):
    """Create a doctor. A post_save signal already makes the DoctorProfile
    (defaulting to OPHTHALMOLOGIST), so update it rather than creating a second."""
    user = User.objects.create_user(
        email=email, password='pw12345!', role=User.Role.DOCTOR,
        first_name='Ada', last_name=email.split('@')[0],
    )
    DoctorProfile.objects.filter(user=user).update(
        specialization=specialization,
        is_accepting_patients=accepting,
        telehealth_enabled=telehealth,
    )
    return user
