from django.urls import path
from .apis import FileUploadAPI, FilePresignedURLAPI

urlpatterns = [
    path('upload/', FileUploadAPI.as_view(), name='storage-upload'),
    path('files/<str:file_id>/url/', FilePresignedURLAPI.as_view(), name='storage-file-url'),
]
