"""Schools router: the profile of the caller's own school.

The schools themselves are created by the platform team, from the
platform module (`app.platform`). A school only manages its own
profile from here.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import supabase_storage
from app.core.context import RequestContext
from app.core.errors import ConflictError, ForbiddenError, ValidationError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context
from app.schools.operations import (
    get_school,
    update_school,
)
from app.schools.schemas import (
    MAX_GALLERY_IMAGES,
    SchoolGalleryImage,
    SchoolOut,
    SchoolUpdateRequest,
)

router = APIRouter(prefix="/v1/schools", tags=["schools"])


def _require_school_admin(context: RequestContext) -> uuid.UUID:
    """Resolve the school the caller administers, or 403.

    Branding is editable only by the school's admin; the school is
    taken from the caller's own primary membership, never the body.
    """
    membership = context.require_any_membership()
    if membership.role != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only school administrators can change the school settings.",
            code="insufficient_role",
        )
    return membership.school_id


def _school_out(school: object) -> SchoolOut:
    """Build the response shape from a School row."""
    return SchoolOut(
        id=school.id,  # type: ignore[attr-defined]
        name=school.name,  # type: ignore[attr-defined]
        short_code=school.short_code,  # type: ignore[attr-defined]
        status=school.status.value,  # type: ignore[attr-defined]
        display_name=school.display_name,  # type: ignore[attr-defined]
        logo_url=school.logo_url,  # type: ignore[attr-defined]
        primary_color=school.primary_color,  # type: ignore[attr-defined]
        mission=school.mission,  # type: ignore[attr-defined]
        vision=school.vision,  # type: ignore[attr-defined]
        banner_url=school.banner_url,  # type: ignore[attr-defined]
        gallery=[
            SchoolGalleryImage(url=image.get("url", ""), caption=image.get("caption"))
            for image in (school.gallery or [])  # type: ignore[attr-defined]
            if image.get("url")
        ],
    )


@router.get("/me", response_model=SchoolOut)
async def get_my_school(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolOut:
    """Return the caller's primary school, including its branding.

    Any member can read it (the sidebar shows the name and logo to
    everyone); editing is admin-only.
    """
    school_id = context.require_any_membership().school_id
    return _school_out(await get_school(session, school_id))


@router.patch("/me", response_model=SchoolOut)
async def update_my_school(
    body: SchoolUpdateRequest,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolOut:
    """Update the caller's school branding (admin only)."""
    school_id = _require_school_admin(context)
    school = await update_school(
        session,
        school_id=school_id,
        changes=body.model_dump(exclude_unset=True),
    )
    await session.commit()
    return _school_out(school)


@router.post("/me/logo", response_model=SchoolOut)
async def upload_my_school_logo(
    file: Annotated[UploadFile, File()],
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolOut:
    """Upload the school logo and store its URL (admin only).

    The image is written to the school-logos bucket with the
    service-role key and the resulting public URL saved on the school.
    """
    school_id = _require_school_admin(context)
    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file is empty.",
        )
    logo_url = await supabase_storage.upload_school_logo(
        school_id=str(school_id),
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    school = await update_school(session, school_id=school_id, changes={"logo_url": logo_url})
    await session.commit()
    return _school_out(school)


@router.post("/me/images", response_model=SchoolOut)
async def upload_my_school_image(
    file: Annotated[UploadFile, File()],
    kind: Annotated[str, Form()],
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolOut:
    """Upload a picture of the school's institutional identity (admin only).

    ``kind`` is ``banner`` (the cover of the dashboard) or ``gallery``
    (one of the pictures the school shows). A banner replaces the
    previous one; a gallery picture is added to the list, which holds at
    most ``MAX_GALLERY_IMAGES`` entries.
    """
    school_id = _require_school_admin(context)

    if kind not in ("banner", "gallery"):
        raise ValidationError(
            "Unsupported image kind. Use banner or gallery.",
            code="invalid_image_kind",
        )

    content = await file.read()
    if not content:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The uploaded file is empty.",
        )

    url = await supabase_storage.upload_school_image(
        school_id=str(school_id),
        kind=kind,
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )

    school = await get_school(session, school_id)

    if kind == "banner":
        changes: dict[str, object] = {"banner_url": url}
    else:
        gallery = list(school.gallery or [])
        if len(gallery) >= MAX_GALLERY_IMAGES:
            raise ConflictError(
                f"The gallery holds at most {MAX_GALLERY_IMAGES} pictures.",
                code="gallery_full",
            )
        gallery.append({"url": url, "caption": None})
        changes = {"gallery": gallery}

    school = await update_school(session, school_id=school_id, changes=changes)
    await session.commit()
    return _school_out(school)


__all__ = ["router"]
