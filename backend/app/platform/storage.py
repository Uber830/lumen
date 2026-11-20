"""Where the files of the catalog live.

The platform team uploads the material to the storage of the platform
and the catalog keeps the key of the object, never its public address:
the file is served with a short-lived signed address, which is built
when it is asked for.

The adapter is behind a small interface, so the destination can change
without touching the catalog. The implementation that ships today
writes to the disk of the server: the files go to the folder named by
`PLATFORM_STORAGE_DIR` (`backend/var/materiales` by default), which is
where they stay until the project gets a bucket to put them in. When
that happens, another adapter of the same interface takes its place and
the catalog does not change.

The original of every piece stays in the repository of the editorial
house: what lives here is the copy the platform serves.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Protocol

from app.config import Settings, get_settings
from app.core.errors import ValidationError

# How long the request to the storage may take.
_TIMEOUT_SECONDS = 60.0


class MaterialStorage(Protocol):
    """Where the files of the catalog are written."""

    async def save(self, *, key: str, content: bytes, content_type: str) -> None:
        """Write the content of a file."""

    async def delete(self, *, key: str) -> None:
        """Remove a file that is not needed anymore."""

    async def read(self, *, key: str) -> bytes:
        """Return the content of a file."""

    async def move(self, *, key: str, new_key: str) -> None:
        """Move a file to another key."""


def storage_root(settings: Settings | None = None) -> Path:
    """The folder where the files of the catalog are written.

    A relative path is resolved against the backend folder, so the
    default (`var/materiales`) lands inside the project and not next
    to wherever the process was started.
    """
    settings = settings or get_settings()
    configured = Path(settings.platform_storage_dir).expanduser()
    if configured.is_absolute():
        return configured
    backend_root = Path(__file__).resolve().parents[2]
    return (backend_root / configured).resolve()


def safe_key(key: str) -> str:
    """The key of a file, checked before it touches the disk.

    The key comes from the catalog, but it is still an input: a key
    with `..` would let a file be written outside of the folder, or one
    of the files of the server be read.
    """
    cleaned = key.strip().replace("\\", "/")
    parts = [part for part in cleaned.split("/") if part not in ("", ".")]
    if not parts or any(part == ".." for part in parts):
        raise ValidationError(
            "The key of the file is not valid.",
            code="invalid_storage_key",
            extra={"key": key},
        )
    return "/".join(parts)


class LocalMaterialStorage:
    """The files of the catalog, on the disk of the server.

    The folder is created the first time a file is written. Every file
    keeps the name it was uploaded with, inside a folder named after
    the material it belongs to.
    """

    def __init__(self, settings: Settings | None = None) -> None:
        self._settings = settings or get_settings()

    def _root(self) -> Path:
        return storage_root(self._settings)

    def _path(self, key: str) -> Path:
        root = self._root()
        target = (root / safe_key(key)).resolve()
        if not target.is_relative_to(root):
            raise ValidationError(
                "The key of the file is not valid.",
                code="invalid_storage_key",
                extra={"key": key},
            )
        return target

    async def save(self, *, key: str, content: bytes, content_type: str) -> None:
        """Write the file, creating the folders it needs."""
        target = self._path(key)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)

    async def delete(self, *, key: str) -> None:
        """Remove the file. A file that is already gone is not an error."""
        target = self._path(key)
        target.unlink(missing_ok=True)

    async def read(self, *, key: str) -> bytes:
        """Return the content of the file."""
        target = self._path(key)
        if not target.is_file():
            raise FileNotFoundError(key)
        return target.read_bytes()

    async def move(self, *, key: str, new_key: str) -> None:
        """Move the file to the folder of its material."""
        source = self._path(key)
        target = self._path(new_key)
        if not source.is_file():
            return
        target.parent.mkdir(parents=True, exist_ok=True)
        source.replace(target)
        # The folder the file leaves behind is removed when it is empty:
        # the pending folder does not keep a trace of what was in it.
        for folder in source.parents:
            if folder == target.parent or folder == self._root():
                break
            if not folder.is_dir() or any(folder.iterdir()):
                break
            folder.rmdir()


def build_storage_key(*, file_name: str, material_code: str | None = None) -> str:
    """The key of an uploaded file inside the storage."""
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
        _storage = LocalMaterialStorage()
    return _storage


def set_storage(storage: MaterialStorage | None) -> None:
    """Replace the storage. Used by the tests."""
    global _storage
    _storage = storage


__all__ = [
    "LocalMaterialStorage",
    "MaterialStorage",
    "build_storage_key",
    "get_storage",
    "safe_key",
    "set_storage",
    "storage_root",
]
