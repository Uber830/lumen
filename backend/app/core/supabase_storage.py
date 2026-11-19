"""Server-side uploads to Supabase Storage.

Newer Supabase projects sign their JWTs with asymmetric keys (ES256),
so the backend cannot mint an HS256 token that Storage will verify —
the browser-direct upload path (token minted by the backend, RLS
checked by Storage) no longer works on those projects.

The service-role key does work: it bypasses RLS. So avatar uploads go
through the backend, which holds that key and never exposes it to the
browser. The backend validates the file and writes it to the bucket on
the user's behalf, scoping the object path to the user's id the same
way the RLS policy would have.
"""

from __future__ import annotations

import uuid

import httpx

from app.config import Settings, get_settings
from app.core.errors import ServiceUnavailableError, ValidationError

# Mirror the avatars bucket's limits (see the profile_avatar migration).
MAX_AVATAR_BYTES = 5 * 1024 * 1024
_AVATAR_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
}

# Mirror the school-logos bucket's limits (PNG/JPEG/SVG, 5 MB).
MAX_LOGO_BYTES = 5 * 1024 * 1024
_LOGO_MIME_EXT = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
}


class SupabaseStorageError(RuntimeError):
    """A Storage request failed."""


def _service_key(cfg: Settings) -> str:
    key = cfg.supabase_secret_key
    if key is None:
        raise ServiceUnavailableError(
            "Supabase Storage is not configured (SUPABASE_SECRET_KEY missing).",
        )
    return key.get_secret_value()


async def upload_avatar(
    *,
    user_id: str,
    content: bytes,
    content_type: str,
    settings: Settings | None = None,
) -> str:
    """Upload an avatar image and return its public URL.

    Validates the MIME type and size, then uploads (upserting) to
    ``avatars/{user_id}/avatar.{ext}`` with the service-role key. The
    bucket is public, so the returned URL is stable; a cache-busting
    query is appended so the browser re-fetches after a replace.
    """
    cfg = settings or get_settings()
    base = cfg.supabase_url.rstrip("/")
    if not base:
        raise ServiceUnavailableError("SUPABASE_URL is not configured.")

    ext = _AVATAR_MIME_EXT.get(content_type)
    if ext is None:
        raise ValidationError(
            "Unsupported image type. Use PNG, JPG or WEBP.",
            code="invalid_image_type",
        )
    if len(content) > MAX_AVATAR_BYTES:
        raise ValidationError("The image exceeds the 5 MB limit.", code="image_too_large")

    path = f"{user_id}/avatar.{ext}"
    key = _service_key(cfg)
    url = f"{base}/storage/v1/object/avatars/{path}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {key}",
                "apikey": key,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=content,
        )

    if response.status_code >= 400:
        raise SupabaseStorageError(f"Storage upload failed: {response.status_code} {response.text}")

    import time

    return f"{base}/storage/v1/object/public/avatars/{path}?v={int(time.time())}"


async def upload_school_logo(
    *,
    school_id: str,
    content: bytes,
    content_type: str,
    settings: Settings | None = None,
) -> str:
    """Upload a school logo and return its public URL.

    Writes to ``school-logos/{school_id}/logo.{ext}`` with the
    service-role key (the bucket's RLS scopes writes by school_id, but
    the service key bypasses RLS and the backend has already checked
    the caller is the school's admin). The bucket accepts PNG, JPEG and
    SVG up to 5 MB.
    """
    return await _upload_to_school_bucket(
        school_id=school_id,
        path=f"{school_id}/logo.{{ext}}",
        content=content,
        content_type=content_type,
        settings=settings,
    )


async def upload_school_image(
    *,
    school_id: str,
    kind: str,
    content: bytes,
    content_type: str,
    settings: Settings | None = None,
) -> str:
    """Upload one of the school's pictures and return its public URL.

    ``kind`` is ``banner`` (the dashboard cover) or ``gallery`` (a
    picture of the gallery). The banner is overwritten in place; every
    gallery picture gets its own file, so the school can have several.
    """
    if kind not in ("banner", "gallery"):
        raise ValidationError(
            "Unsupported image kind. Use banner or gallery.",
            code="invalid_image_kind",
        )

    if kind == "banner":
        path = f"{school_id}/banner.{{ext}}"
    else:
        path = f"{school_id}/gallery/{uuid.uuid4().hex}.{{ext}}"

    return await _upload_to_school_bucket(
        school_id=school_id,
        path=path,
        content=content,
        content_type=content_type,
        settings=settings,
    )


async def _upload_to_school_bucket(
    *,
    school_id: str,
    path: str,
    content: bytes,
    content_type: str,
    settings: Settings | None = None,
) -> str:
    """Write an image to the school-logos bucket and return its URL.

    The bucket accepts PNG, JPEG and SVG up to 5 MB. The service-role
    key bypasses RLS: the caller has already been checked by the
    router, which only lets a school's admin write here.
    """
    cfg = settings or get_settings()
    base = cfg.supabase_url.rstrip("/")
    if not base:
        raise ServiceUnavailableError("SUPABASE_URL is not configured.")

    ext = _LOGO_MIME_EXT.get(content_type)
    if ext is None:
        raise ValidationError(
            "Unsupported image type. Use PNG, JPG or SVG.",
            code="invalid_image_type",
        )
    if len(content) > MAX_LOGO_BYTES:
        raise ValidationError("The logo exceeds the 5 MB limit.", code="image_too_large")

    key = _service_key(cfg)
    public_path = path.format(ext=ext)
    url = f"{base}/storage/v1/object/school-logos/{public_path}"

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {key}",
                "apikey": key,
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=content,
        )

    if response.status_code >= 400:
        raise SupabaseStorageError(f"Storage upload failed: {response.status_code} {response.text}")

    import time

    return f"{base}/storage/v1/object/public/school-logos/{public_path}?v={int(time.time())}"


__all__ = [
    "MAX_AVATAR_BYTES",
    "MAX_LOGO_BYTES",
    "SupabaseStorageError",
    "upload_avatar",
    "upload_school_image",
    "upload_school_logo",
]
