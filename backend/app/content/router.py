"""Content router: the material a teacher posts to a course subject.

The authorization is per course subject, not per school:

- **reads**: a school admin, the teacher assigned to the course
  subject, or a student enrolled in the course it belongs to;
- **writes**: the assigned teacher, or a school admin for deletion;
- **progress**: the student marks their own, the teacher reads who
  finished.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.content import operations
from app.content.schemas import (
    ContentItemCreate,
    ContentItemOut,
    ContentItemUpdate,
    ContentProgressOut,
)
from app.core.access import (
    can_delete_course_subject,
    can_read_course_subject,
    can_write_course_subject,
)
from app.core.context import RequestContext
from app.core.errors import ForbiddenError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context

router = APIRouter(prefix="/v1/content", tags=["content"])


def _changes(body: BaseModel) -> dict[str, object]:
    """The fields of a partial update that were actually sent."""
    return body.model_dump(exclude_unset=True)


@router.get("/items", response_model=list[ContentItemOut])
async def list_content_items(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_subject_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[ContentItemOut]:
    """List the content the caller may read."""
    school_id = context.require_any_membership().school_id
    items = await operations.list_content_items(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=course_subject_id,
    )
    return [ContentItemOut.model_validate(i, from_attributes=True) for i in items]


@router.post("/items", response_model=ContentItemOut, status_code=status.HTTP_201_CREATED)
async def create_content_item(
    body: ContentItemCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ContentItemOut:
    """Post a content item to a course subject."""
    school_id = context.require_any_membership().school_id

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=body.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can post content.",
            code="course_subject_forbidden",
        )

    item = await operations.create_content_item(
        session,
        school_id=school_id,
        posted_by=context.user_id,
        course_subject_id=body.course_subject_id,
        title=body.title,
        description=body.description,
        kind=body.kind,
        storage_path=body.storage_path,
        external_url=body.external_url,
        body=body.body,
    )
    await session.commit()
    return ContentItemOut.model_validate(item, from_attributes=True)


@router.patch("/items/{content_item_id}", response_model=ContentItemOut)
async def update_content_item(
    body: ContentItemUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    content_item_id: Annotated[uuid.UUID, Path()],
) -> ContentItemOut:
    """Update a content item."""
    school_id = context.require_any_membership().school_id

    item = await operations.get_content_item(
        session, content_item_id=content_item_id, school_id=school_id
    )

    # The author can update their own item, as long as they are still
    # the assigned teacher. The policy allows either; requiring both
    # would lock an author out when they are reassigned.
    is_author = item.posted_by == context.user_id
    if not is_author and not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=item.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can edit it.",
            code="course_subject_forbidden",
        )

    updated = await operations.update_content_item(
        session,
        content_item_id=content_item_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return ContentItemOut.model_validate(updated, from_attributes=True)


@router.delete("/items/{content_item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content_item(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    content_item_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a content item."""
    school_id = context.require_any_membership().school_id

    item = await operations.get_content_item(
        session, content_item_id=content_item_id, school_id=school_id
    )

    if not await can_delete_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=item.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can delete it.",
            code="course_subject_forbidden",
        )

    await operations.delete_content_item(
        session, content_item_id=content_item_id, school_id=school_id
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/progress", response_model=list[ContentProgressOut])
async def list_my_progress(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[ContentProgressOut]:
    """The caller's own progress rows.

    A student reads here the material they already completed. The rows
    of the other students are only visible to the teacher of the course
    subject and to the school admins.
    """
    school_id = context.require_any_membership().school_id

    rows = await operations.list_progress_for_student(
        session, school_id=school_id, student_id=context.user_id
    )
    return [ContentProgressOut.model_validate(r, from_attributes=True) for r in rows]


@router.get("/items/{content_item_id}/progress", response_model=list[ContentProgressOut])
async def list_progress(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    content_item_id: Annotated[uuid.UUID, Path()],
) -> list[ContentProgressOut]:
    """List who completed a content item.

    Only the teacher assigned to the course subject and the school
    admins can see this. A student reads their own progress through
    the `/v1/content/progress` endpoint.
    """
    school_id = context.require_any_membership().school_id

    item = await operations.get_content_item(
        session, content_item_id=content_item_id, school_id=school_id
    )

    is_admin = context.role_in(school_id) == SchoolRole.SCHOOL_ADMIN
    if not is_admin and not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=item.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher of this course subject and the school admins can see this.",
            code="course_subject_forbidden",
        )

    rows = await operations.list_progress(
        session, school_id=school_id, content_item_id=content_item_id
    )
    return [ContentProgressOut.model_validate(r, from_attributes=True) for r in rows]


@router.post(
    "/items/{content_item_id}/progress",
    response_model=ContentProgressOut,
    status_code=status.HTTP_201_CREATED,
)
async def mark_completed(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    content_item_id: Annotated[uuid.UUID, Path()],
) -> ContentProgressOut:
    """Mark a content item as completed by the caller."""
    school_id = context.require_any_membership().school_id

    item = await operations.get_content_item(
        session, content_item_id=content_item_id, school_id=school_id
    )

    if not await can_read_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=item.course_subject_id,
    ):
        raise ForbiddenError(
            "You do not have access to this course subject.",
            code="course_subject_forbidden",
        )

    progress = await operations.mark_completed(
        session,
        school_id=school_id,
        content_item_id=content_item_id,
        student_id=context.user_id,
    )
    await session.commit()
    return ContentProgressOut.model_validate(progress, from_attributes=True)


@router.delete(
    "/items/{content_item_id}/progress",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def unmark_completed(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    content_item_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Remove the caller's completion record."""
    school_id = context.require_any_membership().school_id

    item = await operations.get_content_item(
        session, content_item_id=content_item_id, school_id=school_id
    )

    if not await can_read_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=item.course_subject_id,
    ):
        raise ForbiddenError(
            "You do not have access to this course subject.",
            code="course_subject_forbidden",
        )

    await operations.unmark_completed(
        session,
        school_id=school_id,
        content_item_id=content_item_id,
        student_id=context.user_id,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
