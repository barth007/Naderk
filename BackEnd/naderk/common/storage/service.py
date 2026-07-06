from dataclasses import dataclass
from typing import Optional

from django.conf import settings

from .minio_provider import MinIOProvider
from .validators import validate
from .utils import generate_object_key


@dataclass
class UploadResult:
    url: str
    object_key: str
    file_id: str


class StorageService:
    def __init__(self):
        self._provider = MinIOProvider()

    def upload_file(
        self,
        file,
        bucket_type: str = 'public',
        prefix: str = '',
        uploaded_by=None,
    ) -> UploadResult:
        validate(file)

        cfg = settings.STORAGE
        bucket = cfg['PUBLIC_BUCKET'] if bucket_type == 'public' else cfg['PRIVATE_BUCKET']
        is_public = bucket_type == 'public'

        key = generate_object_key(prefix, file.name)
        content_type = getattr(file, 'content_type', 'application/octet-stream') or 'application/octet-stream'

        if hasattr(file, 'seek'):
            file.seek(0)

        url = self._provider.upload(file, key, bucket, content_type)

        from naderk.storage.models import StoredFile
        stored = StoredFile.objects.create(
            object_key=key,
            bucket=bucket,
            original_filename=file.name,
            content_type=content_type,
            file_size=file.size,
            is_public=is_public,
            uploaded_by=uploaded_by,
        )

        return UploadResult(url=url if is_public else '', object_key=key, file_id=str(stored.id))

    def get_presigned_url(self, key: str, bucket: str, expires_in: Optional[int] = None) -> str:
        cfg = settings.STORAGE
        if expires_in is None:
            expires_in = cfg.get('URL_EXPIRATION', 300)
        return self._provider.generate_presigned_url(key, bucket, expires_in)


storage_service = StorageService()
