import os
from .exceptions import StorageValidationError

ALLOWED_IMAGES = {'.jpg', '.jpeg', '.png', '.webp', '.svg'}
ALLOWED_DOCS = {'.pdf', '.docx', '.xlsx', '.csv'}
ALLOWED_EXTENSIONS = ALLOWED_IMAGES | ALLOWED_DOCS
MAX_SIZE = 10 * 1024 * 1024  # 10 MB


def validate(file) -> None:
    if not file:
        raise StorageValidationError("No file provided.")

    if file.size > MAX_SIZE:
        raise StorageValidationError(f"File exceeds maximum size of 10MB.")

    name = getattr(file, 'name', '') or ''
    if '..' in name or '/' in name or '\\' in name:
        raise StorageValidationError("Invalid filename.")

    ext = os.path.splitext(name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise StorageValidationError(
            f"File type '{ext}' is not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )
