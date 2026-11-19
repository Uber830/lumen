"""Task operations.

`tasks` is an assignment posted by a teacher to a course subject.
`task_submissions` is a student's answer, plus its grading.

The rules come from the RLS policies the migrations declared:

- **tasks**: read by a school admin, the assigned teacher or an
  enrolled student; written by the assigned teacher; deleted by either.
- **submissions**: read by a school admin, the assigned teacher or the
  student who made it; written by the student; updated by the student
  or the teacher; deleted by the student.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import can_read_course_subject
from app.core.context import RequestContext
from app.core.errors import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.db.enums import TaskSubmissionStatus
from app.db.models import (
    CourseSubject,
    Task,
    TaskSubmission,
)
from app.notifications.service import (
    notify_task_assigned,
    notify_task_graded,
    notify_task_submitted,
)

# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


async def list_tasks(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID | None = None,
) -> list[Task]:
    """List the tasks the caller may read."""
    statement = select(Task).where(Task.school_id == school_id)
    if course_subject_id is not None:
        statement = statement.where(Task.course_subject_id == course_subject_id)

    result = await session.execute(statement.order_by(Task.due_at.asc().nullslast()))
    rows = list(result.scalars().all())

    if course_subject_id is not None:
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

    readable: set[uuid.UUID] = set()
    for subject_id in {row.course_subject_id for row in rows}:
        if await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=subject_id,
        ):
            readable.add(subject_id)

    return [row for row in rows if row.course_subject_id in readable]


async def get_task(
    session: AsyncSession,
    *,
    task_id: uuid.UUID,
    school_id: uuid.UUID,
) -> Task:
    """Load one task, scoped to the school."""
    result = await session.execute(
        select(Task).where(Task.id == task_id, Task.school_id == school_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Task not found.")
    return row


async def create_task(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    posted_by: uuid.UUID,
    course_subject_id: uuid.UUID,
    title: str,
    description: str | None,
    due_at: datetime | None,
    max_score: Decimal | None,
) -> Task:
    """Post a task to a course subject."""
    await _require_course_subject(session, school_id, course_subject_id)

    task = Task(
        id=uuid.uuid4(),
        school_id=school_id,
        course_subject_id=course_subject_id,
        posted_by=posted_by,
        title=title,
        description=description,
        due_at=due_at,
        max_score=max_score,
    )
    session.add(task)
    await _flush_or_conflict(session)

    # The students of the course are told that a task was posted. It
    # happens inside the transaction of the task itself: the
    # notification exists exactly when the task does.
    await notify_task_assigned(session, task=task)
    return task


async def update_task(
    session: AsyncSession,
    *,
    task_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> Task:
    """Apply a partial update to a task."""
    task = await get_task(session, task_id=task_id, school_id=school_id)

    for field, value in changes.items():
        if value is not None:
            setattr(task, field, value)

    await _flush_or_conflict(session)
    return task


async def delete_task(
    session: AsyncSession,
    *,
    task_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a task."""
    task = await get_task(session, task_id=task_id, school_id=school_id)
    await session.delete(task)
    await session.flush()


async def task_submission_counts(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    task_ids: list[uuid.UUID],
) -> dict[uuid.UUID, tuple[int, int]]:
    """Return {task_id: (pending, total)} for the given tasks.

    A submission is pending when it has been submitted but not graded.
    """
    if not task_ids:
        return {}

    result = await session.execute(
        select(
            TaskSubmission.task_id,
            func.count(TaskSubmission.id).label("total"),
            func.count(TaskSubmission.id)
            .filter(TaskSubmission.status == TaskSubmissionStatus.SUBMITTED)
            .label("pending"),
        )
        .where(
            TaskSubmission.school_id == school_id,
            TaskSubmission.task_id.in_(task_ids),
        )
        .group_by(TaskSubmission.task_id)
    )
    return {row.task_id: (int(row.pending), int(row.total)) for row in result.all()}


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------


async def list_submissions(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    task_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
) -> list[TaskSubmission]:
    """List the submissions the caller may read."""
    statement = select(TaskSubmission).where(TaskSubmission.school_id == school_id)
    if task_id is not None:
        statement = statement.where(TaskSubmission.task_id == task_id)
    if student_id is not None:
        statement = statement.where(TaskSubmission.student_id == student_id)

    result = await session.execute(statement.order_by(TaskSubmission.created_at.desc()))
    return list(result.scalars().all())


async def get_submission(
    session: AsyncSession,
    *,
    submission_id: uuid.UUID,
    school_id: uuid.UUID,
) -> TaskSubmission:
    """Load one submission, scoped to the school."""
    result = await session.execute(
        select(TaskSubmission).where(
            TaskSubmission.id == submission_id,
            TaskSubmission.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Submission not found.")
    return row


async def create_submission(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    task_id: uuid.UUID,
    student_id: uuid.UUID,
    body: str | None,
    file_path: str | None,
    status: TaskSubmissionStatus,
) -> TaskSubmission:
    """Create a submission for a task.

    One submission per student per task: a second one is a conflict.
    """
    # The task has to exist and belong to the school. The call is
    # the check; the row itself is needed here, to tell the teacher
    # that the submission arrived.
    task = await get_task(session, task_id=task_id, school_id=school_id)

    submission = TaskSubmission(
        id=uuid.uuid4(),
        school_id=school_id,
        task_id=task_id,
        student_id=student_id,
        body=body,
        file_path=file_path,
        status=status,
        submitted_at=datetime.now(UTC) if status == TaskSubmissionStatus.SUBMITTED else None,
    )
    session.add(submission)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("You already submitted this task.") from exc

    _check_consistency(submission)

    # A draft is not news yet; only a submitted answer is.
    if status == TaskSubmissionStatus.SUBMITTED:
        await notify_task_submitted(session, task=task, submission=submission)
    return submission


async def update_submission(
    session: AsyncSession,
    *,
    submission_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> TaskSubmission:
    """Apply a partial update to a submission."""
    submission = await get_submission(session, submission_id=submission_id, school_id=school_id)

    # Whether the submission was already graded. The student is told
    # once, when the grading happens, not on every later edit.
    was_graded = submission.status == TaskSubmissionStatus.GRADED

    for field, value in changes.items():
        if value is not None:
            setattr(submission, field, value)

    _apply_status_timestamps(submission)
    _check_consistency(submission)
    await session.flush()

    if submission.status == TaskSubmissionStatus.GRADED and not was_graded:
        task = await get_task(session, task_id=submission.task_id, school_id=school_id)
        await notify_task_graded(session, task=task, submission=submission)
    return submission


async def delete_submission(
    session: AsyncSession,
    *,
    submission_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a submission."""
    submission = await get_submission(session, submission_id=submission_id, school_id=school_id)
    await session.delete(submission)
    await session.flush()


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


def _apply_status_timestamps(submission: TaskSubmission) -> None:
    """Keep the timestamps consistent with the status.

    The database has a check constraint for this; doing it here keeps
    the error message useful instead of surfacing a constraint
    violation.
    """
    now = datetime.now(UTC)
    match submission.status:
        case TaskSubmissionStatus.SUBMITTED:
            if submission.submitted_at is None:
                submission.submitted_at = now
        case TaskSubmissionStatus.DRAFT | TaskSubmissionStatus.RETURNED:
            submission.submitted_at = None
            submission.graded_at = None
            submission.graded_by = None
            submission.grade = None
        case TaskSubmissionStatus.GRADED:
            if submission.submitted_at is None:
                submission.submitted_at = now
            if submission.graded_at is None:
                submission.graded_at = now


def _check_consistency(submission: TaskSubmission) -> None:
    """Verify the status and the timestamps agree.

    This mirrors the `task_submissions_consistency_check` constraint
    the migrations declare.
    """
    match submission.status:
        case TaskSubmissionStatus.SUBMITTED:
            if submission.submitted_at is None:
                raise ValidationError("A submitted task needs a submission date.")
        case TaskSubmissionStatus.DRAFT | TaskSubmissionStatus.RETURNED:
            if submission.submitted_at is not None:
                raise ValidationError("A draft or returned task cannot have a submission date.")
        case TaskSubmissionStatus.GRADED:
            if submission.submitted_at is None:
                raise ValidationError("A graded task needs a submission date.")
            if submission.grade is None:
                raise ValidationError("A graded task needs a grade.")
            if submission.graded_at is None:
                raise ValidationError("A graded task needs a grading date.")


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


async def _flush_or_conflict(session: AsyncSession) -> None:
    """Flush, turning a unique violation into a readable conflict."""
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("That record already exists.") from exc


__all__ = [
    "create_submission",
    "create_task",
    "delete_submission",
    "delete_task",
    "get_submission",
    "get_task",
    "list_submissions",
    "list_tasks",
    "task_submission_counts",
    "update_submission",
    "update_task",
]
