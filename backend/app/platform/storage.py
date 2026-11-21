"""Where the files of the catalog live.

The platform team uploads the material to the storage of the platform
and the catalog keeps the key of the object, never its public address:
the file is served with a short-lived signed address, which is built
when it is asked for.

The adapter is behind a small interface, so the destination can change
without touching the catalog. The implementation that ships today
writes to the object storage the project already uses
(`app.core.supabase_storage`); the bucket is configurable and the
original of every piece stays in the repository of the editorial house.
"""

from __future__ import annotations

import uuid
from typing import Protocol

import httpx

from app.config import Settings, get_settings
from app.core.errors import ServiceUnavailableError

# The bucket the material lives in. It can be moved to another
# destination by changing the adapter, not the catalog.
MATERIALS_BUCKET = "materiales"

# How long the request to the storage may take.
_TIMEOUT_SECONDS = 60.0


class MaterialStorage(Protocol):
    """Where the files of the catalog are written."""

    async def save(self, *, key: str, content: bytes, content_type: str) -> None:
        """Write the content of a file."""

    async def delete(self, *, key: str) -> None:
        """Remove a file that is not needed anymore."""


class SupabaseMaterialStorage:
    """The storage the project already uses.

    It writes with the service key, which bypasses the policies of the
    bucket: the router has already checked that the caller is the
    platform team.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def _base(self) -> str:
        base = self._settings.supabase_url.rstrip("/")
        if not base:
            raise ServiceUnavailableError("SUPABASE_URL is not configured.")
        return base

    def _key(self) -> str:
        key = self._settings.supabase_secret_key
        if key is None:
            raise ServiceUnavailableError(
                "The storage of the catalog is not configured (SUPABASE_SECRET_KEY missing).",
            )
        return key.get_secret_value()

    async def save(self, *, key: str, content: bytes, content_type: str) -> None:
        """Write the file to the bucket."""
        url = f"{self._base()}/storage/v1/object/{MATERIALS_BUCKET}/{key}"
        service_key = self._key()

        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.post(
                url,
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key,
                    "Content-Type": content_type,
                    "x-upsert": "true",
                },
                content=content,
            )

        if response.status_code >= 400:
            raise ServiceUnavailableError(
                f"The storage refused the file ({response.status_code}).",
            )

    async def delete(self, *, key: str) -> None:
        """Remove the file from the bucket."""
        url = f"{self._base()}/storage/v1/object/{MATERIALS_BUCKET}/{key}"
        service_key = self._key()

        async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
            response = await client.delete(
                url,
                headers={
                    "Authorization": f"Bearer {service_key}",
                    "apikey": service_key,
                },
            )

        if response.status_code >= 400 and response.status_code != 404:
            raise ServiceUnavailableError(
                f"The storage could not remove the file ({response.status_code}).",
            )


def build_storage_key(*, file_name: str, material_code: str | None = None) -> str:
    """The key of an uploaded file inside the bucket."""
    safe = "".join(
        character if character.isalnum() or character in "-_." else "-" for character in file_name
    ).strip("-")
    if not safe:
        safe = f"archivo-{uuid.uuid4().hex[:8]}"
    if material_code:
        return f"{material_code}/{safe}"
    return f"pendientes/{uuid.uuid4().hex}/{safe}"


_storage: MaterialStorage | None = None


def get_storage() -> MaterialStorage:
    """The storage the catalog writes to."""
    global _storage
    if _storage is None:
        _storage = SupabaseMaterialStorage()
    return _storage


def set_storage(storage: MaterialStorage | None) -> None:
    """Replace the storage. Used by the tests."""
    global _storage
    _storage = storage


__all__ = [
    "MATERIALS_BUCKET",
    "MaterialStorage",
    "SupabaseMaterialStorage",
    "build_storage_key",
    "get_storage",
    "set_storage",
]
