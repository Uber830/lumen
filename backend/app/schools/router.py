"""Schools router: the profile of the caller's own school.

The schools themselves are created by the platform team, from the
platform module (`app.platform`). A school only manages its own
profile from here.

The editable identity of a school is the name it shows, its shield and
its primary colour. The mission, the vision, the cover picture and
the gallery were removed from the product: they are not part of the
school's work, and the cover picture belongs to the platform team.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.context import RequestContext
from app.core.errors import ForbiddenError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context
from app.schools.operations import (
    get_school,
    update_school,
)
from app.schools.schemas import SchoolOut, SchoolUpdateRequest

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
    logo_path = await storage.upload_school_logo(
        school_id=str(school_id),
        content=content,
        content_type=file.content_type or "application/octet-stream",
    )
    school = await update_school(session, school_id=school_id, changes={"logo_url": logo_path})
    await session.commit()
    return _school_out(school)


__all__ = ["router"]
