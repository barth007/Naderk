import boto3
from botocore.exceptions import ClientError
from django.conf import settings

from .base import StorageProvider
from .exceptions import StorageProviderError


class MinIOProvider(StorageProvider):
    def __init__(self):
        cfg = settings.STORAGE
        self._endpoint = cfg['ENDPOINT']
        self._public_endpoint = cfg.get('PUBLIC_ENDPOINT', cfg['ENDPOINT'])
        self._client = boto3.client(
            's3',
            endpoint_url=cfg['ENDPOINT'],
            aws_access_key_id=cfg['ACCESS_KEY'],
            aws_secret_access_key=cfg['SECRET_KEY'],
            region_name=cfg.get('REGION', 'us-east-1'),
            use_ssl=cfg.get('USE_SSL', False),
        )

    def upload(self, file, key: str, bucket: str, content_type: str) -> str:
        try:
            self._client.upload_fileobj(
                file,
                bucket,
                key,
                ExtraArgs={'ContentType': content_type},
            )
            return self.get_public_url(key, bucket)
        except ClientError as e:
            raise StorageProviderError(str(e)) from e

    def delete(self, key: str, bucket: str) -> None:
        try:
            self._client.delete_object(Bucket=bucket, Key=key)
        except ClientError as e:
            raise StorageProviderError(str(e)) from e

    def exists(self, key: str, bucket: str) -> bool:
        try:
            self._client.head_object(Bucket=bucket, Key=key)
            return True
        except ClientError:
            return False

    def get_public_url(self, key: str, bucket: str) -> str:
        return f"{self._public_endpoint}/{bucket}/{key}"

    def generate_presigned_url(self, key: str, bucket: str, expires_in: int) -> str:
        try:
            return self._client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=expires_in,
            )
        except ClientError as e:
            raise StorageProviderError(str(e)) from e
