from abc import ABC, abstractmethod


class StorageProvider(ABC):
    @abstractmethod
    def upload(self, file, key: str, bucket: str, content_type: str) -> str:
        ...

    @abstractmethod
    def delete(self, key: str, bucket: str) -> None:
        ...

    @abstractmethod
    def exists(self, key: str, bucket: str) -> bool:
        ...

    @abstractmethod
    def get_public_url(self, key: str, bucket: str) -> str:
        ...

    @abstractmethod
    def generate_presigned_url(self, key: str, bucket: str, expires_in: int) -> str:
        ...
