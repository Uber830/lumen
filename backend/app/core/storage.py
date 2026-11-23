"""The file store of the application.

The files live on the disk of the server: there is no third-party
storage in the middle. The backend writes them, the backend serves them
back and the rows of the database point to its own URLs.

The paths keep the conventions of the buckets the app used to have
(``avatars``, ``school-logos``, ``class-content``,
``task-submissions``), so the rows that are already in the database
keep their meaning: the bucket is the first segment of the path and
the rest is the name of the object.

A path is always relative to the root of the store (``avatars/<user>/
avatar.png``) and never absolute: the reader of the row builds the URL
against the base of the API.
"""

from __future__ import annotations

import re
import shutil
import time
import unicodedata
from pathlib import Path

from app.config import Settings, get_settings
from app.core.errors import ServiceUnavailableError, ValidationError

# The buckets of the store. They are the segments the paths start with.
BUCKETS = (
    "avatars",
    "school-logos",
    "class-content",
    "task-submissions",
)

# The limits of each kind of file.
MAX_AVATAR_BYTES = 5 * 1024 * 1024
MAX_LOGO_BYTES = 5 * 1024 * 1024

_AVATAR_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

_LOGO_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
}

# The content type the browser gets for each extension.
_EXT_CONTENT_TYPE = {
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "svg": "image/svg+xml",
    "pdf": "application/pdf",
    "txt": "text/plain; charset=utf-8",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "mp4": "video/mp4",
    "mp3": "audio/mpeg",
    "zip": "application/zip",
}


class StorageError(RuntimeError):
    """A file could not be written or read."""


def storage_root(settings: Settings | None = None) -> Path:
    """The directory where the files live.

    A relative path is resolved against the backend folder, so the
    default (`var/archivos`) lands inside the project and not next to
    wherever the process was started.
    """
    cfg = settings or get_settings()
    configured = Path(cfg.uploads_dir).expanduser()
    if configured.is_absolute():
        return configured.resolve()
    backend_root = Path(__file__).resolve().parents[2]
    return (backend_root / configured).resolve()


def safe_name(name: str) -> str:
    """The name of a file, cleaned before it touches the disk.

    The browser sends the name the person gave the file: it can have
    spaces, accents or characters the file system does not like. The
    name keeps its extension, because the reader of the row uses it to
    know the type of the file.
    """
    cleaned = re.sub(r"[^a-zA-Z0-9._-]+", "-", unicodedata.normalize("NFD", name))
    cleaned = re.sub(r"-+", "-", cleaned).strip("-. ")[:120]
    return cleaned or "archivo"


def _safe_path(root: Path, relative: str) -> Path:
    """The absolute path of a relative one, without leaving the store."""
    candidate = (root / relative).resolve()
    if not candidate.is_relative_to(root):
        raise ValidationError("Invalid file path.", code="invalid_path")
    return candidate


def write_file(
    relative: str,
    content: bytes,
    *,
    content_type: str | None = None,
    settings: Settings | None = None,
) -> str:
    """Write a file in the store and return its relative path.

    The path is created if it does not exist, and the file replaces
    whatever was there with the same name.
    """
    root = storage_root(settings)
    target = _safe_path(root, relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return relative


def read_file(relative: str, *, settings: Settings | None = None) -> bytes:
    """Read a file of the store."""
    root = storage_root(settings)
    target = _safe_path(root, relative)
    if not target.is_file():
        raise FileNotFoundError(relative)
    return target.read_bytes()


def delete_file(relative: str, *, settings: Settings | None = None) -> None:
    """Remove a file of the store. A missing file is not an error."""
    root = storage_root(settings)
    target = _safe_path(root, relative)
    if target.is_file():
        target.unlink()


def content_type_for(relative: str) -> str:
    """The content type of a file, by its extension."""
    extension = relative.rsplit(".", 1)[-1].lower() if "." in relative else ""
    return _EXT_CONTENT_TYPE.get(extension, "application/octet-stream")


def public_path(relative: str) -> str:
    """The path the API serves a file under."""
    return f"/v1/files/{relative.lstrip('/')}"


def public_url(relative: str, *, settings: Settings | None = None) -> str:
    """The absolute URL of a file, when the API knows its own address."""
    cfg = settings or get_settings()
    base = (cfg.public_base_url or "").rstrip("/")
    return f"{base}{public_path(relative)}"


async def upload_avatar(
    *,
    user_id: str,
    content: bytes,
    content_type: str,
    settings: Settings | None = None,
) -> str:
    """Store an avatar image and return the path of the file.

    Validates the MIME type and the size, then writes the image to
    ``avatars/{user_id}/avatar.{ext}``. The name carries the moment of
    the upload, so a replaced photo is never the cached one.
    """
    ext = _AVATAR_MIME_EXT.get(content_type)
    if ext is None:
        raise ValidationError(
            "Unsupported image type. Use PNG, JPG or WEBP.",
            code="invalid_image_type",
        )
    if len(content) > MAX_AVATAR_BYTES:
        raise ValidationError("The image exceeds the 5 MB limit.", code="image_too_large")

    relative = f"avatars/{user_id}/avatar-{int(time.time())}.{ext}"
    try:
        write_file(relative, content, content_type=content_type, settings=settings)
    except OSError as exc:
        raise ServiceUnavailableError("The file store is not available.") from exc
    return relative


async def upload_school_logo(
    *,
    school_id: str,
    content: bytes,
    content_type: str,
    settings: Settings | None = None,
) -> str:
    """Store the logo of a school and return the path of the file.

    Writes to ``school-logos/{school_id}/logo.{ext}``. The logo
    accepts PNG, JPEG and SVG up to 5 MB.
    """
    ext = _LOGO_MIME_EXT.get(content_type)
    if ext is None:
        raise ValidationError(
            "Unsupported image type. Use PNG, JPG or SVG.",
            code="invalid_image_type",
        )
    if len(content) > MAX_LOGO_BYTES:
        raise ValidationError("The image exceeds the 5 MB limit.", code="image_too_large")

    relative = f"school-logos/{school_id}/logo-{int(time.time())}.{ext}"
    try:
        write_file(relative, content, content_type=content_type, settings=settings)
    except OSError as exc:
        raise ServiceUnavailableError("The file store is not available.") from exc
    return relative


def replace_file(
    *,
    bucket: str,
    owner: str,
    filename: str,
    content: bytes,
    content_type: str | None = None,
    settings: Settings | None = None,
) -> str:
    """Write a file that belongs to a school or a user.

    The old file with the same name is removed, so the store does not
    grow with every version of the same document.
    """
    root = storage_root(settings)
    relative = f"{bucket}/{owner}/{filename}"
    target = _safe_path(root, relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return relative


def clear_bucket(bucket: str, *, settings: Settings | None = None) -> None:
    """Remove every file of a bucket. Used by the tests."""
    root = storage_root(settings)
    target = _safe_path(root, bucket)
    if target.is_dir():
        shutil.rmtree(target)
