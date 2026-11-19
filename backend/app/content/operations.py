"""Content operations.

`content_items` is the material a teacher posts to a course subject.
`content_progress` records that a student finished reading it.

The authorization is per course subject, not per school: see
`app/core/access.py` for the rules.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import can_read_course_subject
from app.core.context import RequestContext
from app.core.errors import ForbiddenError, NotFoundError
from app.db.enums import ContentKind
from app.db.models import ContentItem, ContentProgress, CourseSubject
from app.notifications.service import notify_content_published


async def list_content_items(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID | None = None,
) -> list[ContentItem]:
    """List the content items the caller may read.

    The list is filtered by the caller's access to each course
    subject, not just by school: a student sees the material of the
    courses they are enrolled in, and nothing else.
    """
    statement = select(ContentItem).where(ContentItem.school_id == school_id)

    if course_subject_id is not None:
        statement = statement.where(ContentItem.course_subject_id == course_subject_id)

    result = await session.execute(statement.order_by(ContentItem.posted_at.desc()))
    rows = list(result.scalars().all())

    if course_subject_id is not None:
        # The filter was explicit: check access once.
        if not await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=course_subject_id,
        ):
            raise ForbiddenError(
                "You do not have access to this course subject.",
                code="course_subject_forbidden",
            )
        return rows

    # Without an explicit filter, check each course subject the caller
    # can reach. The number of distinct course subjects in a school is
    # small, so this stays cheap.
    readable: set[uuid.UUID] = set()
    for course_subject_id in {row.course_subject_id for row in rows}:
        if await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=course_subject_id,
        ):
            readable.add(course_subject_id)

    return [row for row in rows if row.course_subject_id in readable]


async def get_content_item(
    session: AsyncSession,
    *,
    content_item_id: uuid.UUID,
    school_id: uuid.UUID,
) -> ContentItem:
    """Load one content item, scoped to the school."""
    result = await session.execute(
        select(ContentItem).where(
            ContentItem.id == content_item_id,
            ContentItem.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Content item not found.")
    return row


async def create_content_item(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    posted_by: uuid.UUID,
    course_subject_id: uuid.UUID,
    title: str,
    description: str | None,
    kind: ContentKind,
    storage_path: str | None,
    external_url: str | None,
    body: str | None,
) -> ContentItem:
    """Post a content item to a course subject."""
    await _require_course_subject(session, school_id, course_subject_id)

    item = ContentItem(
        id=uuid.uuid4(),
        school_id=school_id,
        course_subject_id=course_subject_id,
        posted_by=posted_by,
        title=title,
        description=description,
        kind=kind,
        storage_path=storage_path,
        external_url=external_url,
        body=body,
        posted_at=datetime.now(UTC),
    )
    session.add(item)
    await _flush_or_conflict(session)

    # The students of the course are told that new material was
    # posted, in the same transaction as the material itself.
    await notify_content_published(session, item=item)
    return item


async def update_content_item(
    session: AsyncSession,
    *,
    content_item_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> ContentItem:
    """Apply a partial update to a content item."""
    item = await get_content_item(session, content_item_id=content_item_id, school_id=school_id)

    for field, value in changes.items():
        if value is not None:
            setattr(item, field, value)

    _check_shape(item)
    await _flush_or_conflict(session)
    return item


async def delete_content_item(
    session: AsyncSession,
    *,
    content_item_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a content item."""
    item = await get_content_item(session, content_item_id=content_item_id, school_id=school_id)
    await session.delete(item)
    await session.flush()


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------


async def list_progress(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    content_item_id: uuid.UUID,
) -> list[ContentProgress]:
    """List who completed a content item."""
    result = await session.execute(
        select(ContentProgress)
        .where(
            ContentProgress.school_id == school_id,
            ContentProgress.content_item_id == content_item_id,
        )
        .order_by(ContentProgress.completed_at.desc())
    )
    return list(result.scalars().all())


async def list_progress_for_student(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
) -> list[ContentProgress]:
    """The progress rows of one student.

    This is the student's own view of their progress: it never shows
    what another student did.
    """
    result = await session.execute(
        select(ContentProgress)
        .where(
            ContentProgress.school_id == school_id,
            ContentProgress.student_id == student_id,
        )
        .order_by(ContentProgress.completed_at.desc())
    )
    return list(result.scalars().all())


async def mark_completed(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    content_item_id: uuid.UUID,
    student_id: uuid.UUID,
) -> ContentProgress:
    """Record that a student finished a content item.

    Idempotent: marking an item complete twice returns the existing
    row instead of failing.
    """
    existing = await session.execute(
        select(ContentProgress).where(
            ContentProgress.content_item_id == content_item_id,
            ContentProgress.student_id == student_id,
        )
    )
    row = existing.scalar_one_or_none()
    if row is not None:
        return row

    progress = ContentProgress(
        id=uuid.uuid4(),
        school_id=school_id,
        content_item_id=content_item_id,
        student_id=student_id,
        completed_at=datetime.now(UTC),
    )
    session.add(progress)
    await _flush_or_conflict(session)
    return progress


async def unmark_completed(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    content_item_id: uuid.UUID,
    student_id: uuid.UUID,
) -> None:
    """Remove a completion record."""
    result = await session.execute(
        select(ContentProgress).where(
            ContentProgress.school_id == school_id,
            ContentProgress.content_item_id == content_item_id,
            ContentProgress.student_id == student_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Progress record not found.")
    await session.delete(row)
    await session.flush()


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


async def _require_course_subject(
    session: AsyncSession,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> CourseSubject:
    """Load a course subject, scoped to the school."""
    result = await session.execute(
        select(CourseSubject).where(
            CourseSubject.id == course_subject_id,
            CourseSubject.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Course subject not found.")
    return row


def _check_shape(item: ContentItem) -> None:
    """Verify the item still has the fields its kind requires."""
    from app.core.errors import ValidationError

    match item.kind:
        case ContentKind.DOCUMENT:
            if not item.storage_path:
                raise ValidationError("A document requires storage_path.")
        case ContentKind.VIDEO:
            if not item.storage_path and not item.external_url:
                raise ValidationError("A video requires storage_path or external_url.")
        case ContentKind.LINK:
            if not item.external_url:
                raise ValidationError("A link requires external_url.")
        case ContentKind.TEXT:
            if not item.body:
                raise ValidationError("A text item requires body.")


async def _flush_or_conflict(session: AsyncSession) -> None:
    """Flush, turning a unique violation into a readable conflict."""
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        from app.core.errors import ConflictError

        raise ConflictError("That record already exists.") from exc


__all__ = [
    "create_content_item",
    "delete_content_item",
    "get_content_item",
    "list_content_items",
    "list_progress",
    "mark_completed",
    "unmark_completed",
    "update_content_item",
]
