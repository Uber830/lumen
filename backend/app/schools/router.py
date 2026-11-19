"""Schools router: the signup bootstrap and the school profile.

`POST /v1/schools/bootstrap` is the Python port of the
`bootstrap_school` SQL function. The frontend's signup flow calls it
with the school details, the admin details and the chosen plan.

The operation is idempotent: calling it twice with the same admin
returns the school created by the first call instead of a duplicate.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import supabase_storage
from app.core.context import RequestContext
from app.core.errors import ConflictError, ForbiddenError, NotFoundError, ValidationError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context
from app.schools.operations import (
    DEFAULT_TRIAL_DAYS,
    BootstrapError,
    bootstrap_school,
    get_school,
    update_school,
)
from app.schools.schemas import (
    MAX_GALLERY_IMAGES,
    BootstrapResponse,
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


class BootstrapRequest(BaseModel):
    """Body for POST /v1/schools/bootstrap."""

    school_name: str = Field(min_length=2, max_length=120)
    short_code: str = Field(min_length=2, max_length=16)
    plan_code: str = Field(min_length=1, max_length=64)
    trial_days: int = Field(default=DEFAULT_TRIAL_DAYS, ge=1, le=365)

    @field_validator("school_name", "short_code", "plan_code")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


@router.post("/bootstrap", status_code=status.HTTP_201_CREATED)
async def bootstrap(
    body: BootstrapRequest,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> BootstrapResponse:
    """Create a school for the caller, with its trial subscription.

    The caller becomes the school's `school_admin`. Calling it again
    returns the school created by the first call.
    """
    try:
        result = await bootstrap_school(
            session,
            user_id=context.user_id,
            school_name=body.school_name,
            short_code=body.short_code,
            plan_code=body.plan_code,
            trial_days=body.trial_days,
        )
    except BootstrapError as exc:
        await session.rollback()
        # The business errors keep the SQLSTATE codes the frontend
        # already knows how to translate.
        if exc.code == "23505":
            raise ConflictError(exc.message, code="duplicate_school") from exc
        if exc.code == "P0002":
            raise NotFoundError(exc.message, code="plan_not_found") from exc
        raise ValidationError(exc.message, code="invalid_input") from exc

    await session.commit()

    return BootstrapResponse(
        school_id=result.school_id,
        membership_id=result.membership_id,
        subscription_id=result.subscription_id,
        entitlement_id=result.entitlement_id,
        already_existed=result.already_existed,
    )


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


__all__ = ["BootstrapRequest", "router"]
