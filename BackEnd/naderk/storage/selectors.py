from rest_framework.exceptions import NotFound, PermissionDenied
from .models import StoredFile


def get_stored_file(file_id: str, user) -> StoredFile:
    try:
        stored = StoredFile.objects.get(id=file_id)
    except StoredFile.DoesNotExist:
        raise NotFound("File not found.")

    from naderk.core.models import User
    is_staff = user.role in {User.Role.ADMIN, User.Role.SUPER_ADMIN, User.Role.DOCTOR, User.Role.MEDICAL_AGENT}
    if not is_staff and stored.uploaded_by_id != user.id:
        raise PermissionDenied("You do not have permission to access this file.")

    return stored
