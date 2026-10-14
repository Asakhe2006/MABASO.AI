"""Private object storage used by the Mabaso AI personal Library.

The browser never receives the Supabase service-role key. Files are proxied
through authenticated backend routes so object ownership is always checked
against the signed-in Mabaso AI account.
"""

from __future__ import annotations

import os
import threading
from dataclasses import dataclass
from urllib.parse import quote

import requests


class LibraryStorageError(RuntimeError):
    """Safe storage-provider failure metadata for backend error handling."""

    def __init__(self, message: str, *, status_code: int | None = None, provider_message: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.provider_message = provider_message[:240]


def _safe_provider_message(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        payload = {}
    if not isinstance(payload, dict):
        return ""
    value = payload.get("message") or payload.get("error") or payload.get("statusCode") or ""
    return " ".join(str(value).split())[:240]


@dataclass(frozen=True)
class LibraryStorageConfig:
    base_url: str
    service_key: str
    bucket: str
    timeout_seconds: float
    auto_create_bucket: bool
    bucket_file_size_limit: int

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.service_key and self.bucket)


def get_library_storage_config() -> LibraryStorageConfig:
    return LibraryStorageConfig(
        base_url=(os.getenv("SUPABASE_URL") or "").strip().rstrip("/"),
        service_key=(os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "").strip(),
        bucket=(os.getenv("SUPABASE_LIBRARY_BUCKET") or "mabaso-library").strip(),
        timeout_seconds=max(5.0, float(os.getenv("SUPABASE_REQUEST_TIMEOUT_SECONDS", "12"))),
        auto_create_bucket=(os.getenv("SUPABASE_LIBRARY_AUTO_CREATE_BUCKET", "false").strip().lower() in {"1", "true", "yes", "on"}),
        bucket_file_size_limit=max(1, int(os.getenv("SUPABASE_LIBRARY_BUCKET_FILE_SIZE_LIMIT", "52428800"))),
    )


class SupabaseLibraryStorage:
    def __init__(self, config: LibraryStorageConfig | None = None):
        self.config = config or get_library_storage_config()
        self._bucket_lock = threading.Lock()

    @property
    def configured(self) -> bool:
        return self.config.configured

    def _object_url(self, object_key: str) -> str:
        safe_bucket = quote(self.config.bucket, safe="")
        safe_key = quote(object_key.strip("/"), safe="/")
        return f"{self.config.base_url}/storage/v1/object/{safe_bucket}/{safe_key}"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.config.service_key}",
            "apikey": self.config.service_key,
        }

    def ensure_private_bucket(self) -> None:
        """Create only the configured private bucket when explicitly enabled."""
        if not self.configured:
            raise LibraryStorageError("Private Library storage is not configured.")
        safe_bucket = quote(self.config.bucket, safe="")
        with self._bucket_lock:
            lookup = requests.get(
                f"{self.config.base_url}/storage/v1/bucket/{safe_bucket}",
                headers=self._headers(),
                timeout=self.config.timeout_seconds,
            )
            if lookup.status_code == 200:
                return
            if lookup.status_code != 404:
                raise LibraryStorageError(
                    f"Private bucket lookup failed with status {lookup.status_code}.",
                    status_code=lookup.status_code,
                    provider_message=_safe_provider_message(lookup),
                )
            created = requests.post(
                f"{self.config.base_url}/storage/v1/bucket",
                headers={**self._headers(), "Content-Type": "application/json"},
                json={
                    "id": self.config.bucket,
                    "name": self.config.bucket,
                    "public": False,
                    "file_size_limit": self.config.bucket_file_size_limit,
                },
                timeout=self.config.timeout_seconds,
            )
            if created.status_code not in {200, 201}:
                # Another Render worker may have created the same approved
                # bucket between our lookup and create calls. Re-read the
                # exact bucket before reporting a failure.
                if created.status_code in {400, 409}:
                    concurrent_lookup = requests.get(
                        f"{self.config.base_url}/storage/v1/bucket/{safe_bucket}",
                        headers=self._headers(),
                        timeout=self.config.timeout_seconds,
                    )
                    if concurrent_lookup.status_code == 200:
                        return
                raise LibraryStorageError(
                    f"Private bucket creation failed with status {created.status_code}.",
                    status_code=created.status_code,
                    provider_message=_safe_provider_message(created),
                )

    def put(self, object_key: str, content: bytes, content_type: str) -> None:
        if not self.configured:
            raise LibraryStorageError("Private Library storage is not configured.")
        headers = {
            **self._headers(),
            "Content-Type": content_type or "application/octet-stream",
            "x-upsert": "false",
        }
        def upload():
            return requests.post(
                self._object_url(object_key),
                headers=headers,
                data=content,
                timeout=self.config.timeout_seconds,
            )

        response = upload()
        if response.status_code == 404 and self.config.auto_create_bucket:
            self.ensure_private_bucket()
            response = upload()
        if response.status_code not in {200, 201}:
            raise LibraryStorageError(
                f"Private object upload failed with status {response.status_code}.",
                status_code=response.status_code,
                provider_message=_safe_provider_message(response),
            )

    def get(self, object_key: str) -> bytes:
        if not self.configured:
            raise LibraryStorageError("Private Library storage is not configured.")
        response = requests.get(
            self._object_url(object_key),
            headers=self._headers(),
            timeout=self.config.timeout_seconds,
        )
        if response.status_code != 200:
            raise LibraryStorageError(
                f"Private object download failed with status {response.status_code}.",
                status_code=response.status_code,
                provider_message=_safe_provider_message(response),
            )
        return response.content

    def delete(self, object_keys: list[str]) -> None:
        clean_keys = [key.strip("/") for key in object_keys if key and key.strip("/")]
        if not clean_keys:
            return
        if not self.configured:
            raise LibraryStorageError("Private Library storage is not configured.")
        bucket_url = f"{self.config.base_url}/storage/v1/object/{quote(self.config.bucket, safe='')}"
        response = requests.delete(
            bucket_url,
            headers={**self._headers(), "Content-Type": "application/json"},
            json={"prefixes": clean_keys},
            timeout=self.config.timeout_seconds,
        )
        if response.status_code not in {200, 204}:
            raise LibraryStorageError(
                f"Private object deletion failed with status {response.status_code}.",
                status_code=response.status_code,
                provider_message=_safe_provider_message(response),
            )
