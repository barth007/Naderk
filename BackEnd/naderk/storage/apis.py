from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from naderk.common.responses.builders import build_success_response, build_error_response
from naderk.common.storage.service import storage_service
from naderk.common.storage.exceptions import StorageValidationError, StorageProviderError
from .selectors import get_stored_file


class FileUploadAPI(APIView):
    """
    POST /api/v1/storage/upload/
    Generic authenticated file upload. Returns the URL.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail="No file provided.",
                instance=request.path,
            )

        bucket_type = request.data.get('bucket_type', 'public')
        prefix = request.data.get('prefix', '')

        try:
            result = storage_service.upload_file(
                file,
                bucket_type=bucket_type,
                prefix=prefix,
                uploaded_by=request.user,
            )
            return build_success_response(
                "File uploaded successfully.",
                {"url": result.url, "file_id": result.file_id, "object_key": result.object_key},
            )
        except StorageValidationError as e:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/validation-error",
                title="Validation Error",
                status_code=400,
                detail=str(e),
                instance=request.path,
            )
        except StorageProviderError as e:
            return build_error_response(
                type_uri="https://api.naderkeye.com/problems/storage-error",
                title="Storage Error",
                status_code=500,
                detail=str(e),
                instance=request.path,
            )


class FilePresignedURLAPI(APIView):
    """
    GET /api/v1/storage/files/<file_id>/url/
    Generate a presigned URL for a private file.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, file_id):
        stored = get_stored_file(file_id, request.user)
        cfg_expiration = None
        url = storage_service.get_presigned_url(stored.object_key, stored.bucket, cfg_expiration)
        return build_success_response("Presigned URL generated.", {"url": url})
