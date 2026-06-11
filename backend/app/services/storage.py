"""File storage abstraction: local disk for dev, GCS for production.

Files are keyed by "{user_id}/{document_id}{ext}". Download URLs:
- local: served through the authenticated /documents/{id}/download endpoint
- gcs:   short-lived signed URL generated on demand
"""

import logging
from abc import ABC, abstractmethod
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class Storage(ABC):
    @abstractmethod
    async def save(self, key: str, data: bytes, content_type: str) -> str:
        """Store bytes; returns the storage path persisted on the Document."""
        ...

    @abstractmethod
    async def read(self, key: str) -> bytes:
        ...

    @abstractmethod
    async def delete(self, key: str) -> None:
        ...

    @abstractmethod
    async def download_url(self, key: str) -> str | None:
        """Direct URL if the backend supports it (GCS signed URL); None means
        the API should stream the bytes itself."""
        ...


class LocalStorage(Storage):
    def __init__(self) -> None:
        self.root = Path(settings.UPLOAD_DIR)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root.resolve()):
            raise ValueError("Invalid storage key")
        return path

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    async def read(self, key: str) -> bytes:
        return self._path(key).read_bytes()

    async def delete(self, key: str) -> None:
        self._path(key).unlink(missing_ok=True)

    async def download_url(self, key: str) -> str | None:
        return None


class GCSStorage(Storage):
    def __init__(self) -> None:
        from google.cloud import storage as gcs  # lazy: optional dependency

        self.bucket = gcs.Client().bucket(settings.GCS_BUCKET_NAME)

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        import anyio

        blob = self.bucket.blob(key)
        await anyio.to_thread.run_sync(
            lambda: blob.upload_from_string(data, content_type=content_type)
        )
        return key

    async def read(self, key: str) -> bytes:
        import anyio

        return await anyio.to_thread.run_sync(self.bucket.blob(key).download_as_bytes)

    async def delete(self, key: str) -> None:
        import anyio

        await anyio.to_thread.run_sync(self.bucket.blob(key).delete)

    async def download_url(self, key: str) -> str | None:
        import datetime

        import anyio

        blob = self.bucket.blob(key)
        return await anyio.to_thread.run_sync(
            lambda: blob.generate_signed_url(
                version="v4", expiration=datetime.timedelta(minutes=15)
            )
        )


class S3Storage(Storage):
    def __init__(self) -> None:
        import boto3  # lazy: optional dependency

        self.client = boto3.client("s3", region_name=settings.AWS_REGION or None)
        self.bucket = settings.S3_BUCKET_NAME

    async def save(self, key: str, data: bytes, content_type: str) -> str:
        import anyio

        await anyio.to_thread.run_sync(
            lambda: self.client.put_object(
                Bucket=self.bucket, Key=key, Body=data, ContentType=content_type
            )
        )
        return key

    async def read(self, key: str) -> bytes:
        import anyio

        def _get() -> bytes:
            return self.client.get_object(Bucket=self.bucket, Key=key)["Body"].read()

        return await anyio.to_thread.run_sync(_get)

    async def delete(self, key: str) -> None:
        import anyio

        await anyio.to_thread.run_sync(
            lambda: self.client.delete_object(Bucket=self.bucket, Key=key)
        )

    async def download_url(self, key: str) -> str | None:
        import anyio

        return await anyio.to_thread.run_sync(
            lambda: self.client.generate_presigned_url(
                "get_object", Params={"Bucket": self.bucket, "Key": key}, ExpiresIn=900
            )
        )


_storage: Storage | None = None

_BACKENDS = {"local": LocalStorage, "gcs": GCSStorage, "s3": S3Storage}


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        _storage = _BACKENDS[settings.STORAGE_BACKEND]()
        logger.info("Storage backend: %s", settings.STORAGE_BACKEND)
    return _storage


def reset_storage() -> None:
    global _storage
    _storage = None
