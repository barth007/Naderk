import os
import uuid


def generate_object_key(prefix: str, filename: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    unique_id = uuid.uuid4().hex
    if prefix:
        return f"{prefix}/{unique_id}{ext}"
    return f"{unique_id}{ext}"
