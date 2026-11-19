"""Tasks router: the assignments and their submissions.

The authorization is per course subject, and the submissions have
their own rules on top:

- **tasks**: read by a school admin, the assigned teacher or an
  enrolled student; written by the assigned teacher.
- **submissions**: read by a school admin, the assigned teacher or the
  student who made it. A student writes their own; a teacher grades
  them.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import (
    can_delete_course_subject,
    can_read_course_subject,
    can_write_course_subject,
)
from app.core.context import RequestContext
from app.core.errors import ForbiddenError
from app.db.enums import SchoolRole
from app.db.models import Task
from app.db.session import get_db
from app.deps import get_context
from app.tasks import operations
from app.tasks.schemas import (
    SubmissionCreate,
    SubmissionOut,
    SubmissionUpdate,
    TaskCreate,
    TaskOut,
    TaskSummary,
    TaskUpdate,
)

router = APIRouter(prefix="/v1/tasks", tags=["tasks"])


def _changes(body: BaseModel) -> dict[str, object]:
    """The fields of a partial update that were actually sent."""
    return body.model_dump(exclude_unset=True)


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------


@router.get("", response_model=list[TaskSummary])
async def list_tasks(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_subject_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[TaskSummary]:
    """List the tasks the caller may read, with their submission counts."""
    school_id = context.require_any_membership().school_id

    tasks = await operations.list_tasks(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=course_subject_id,
    )

    counts = await operations.task_submission_counts(
        session, school_id=school_id, task_ids=[task.id for task in tasks]
    )

    labels = await _course_subject_labels(session, school_id, tasks)

    summaries: list[TaskSummary] = []
    for task in tasks:
        pending, total = counts.get(task.id, (0, 0))
        summaries.append(
            TaskSummary(
                **TaskOut.model_validate(task, from_attributes=True).model_dump(),
                course_subject_label=labels.get(task.course_subject_id, ""),
                pending_submissions=pending,
                total_submissions=total,
            )
        )
    return summaries


async def _course_subject_labels(
    session: AsyncSession,
    school_id: uuid.UUID,
    tasks: list[Task],
) -> dict[uuid.UUID, str]:
    """Resolve the "course - subject" label of each task's course subject."""
    if not tasks:
        return {}

    from sqlalchemy import select

    from app.db.models import Course, CourseSubject, Subject

    subject_ids = {task.course_subject_id for task in tasks}
    rows = await session.execute(
        select(CourseSubject.id, Course.name, Subject.name)
        .join(Course, Course.id == CourseSubject.course_id)
        .join(Subject, Subject.id == CourseSubject.subject_id)
        .where(
            CourseSubject.id.in_(subject_ids),
            CourseSubject.school_id == school_id,
        )
    )
    return {row[0]: f"{row[1]} - {row[2]}" for row in rows.all()}


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(
    body: TaskCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> TaskOut:
    """Post a task to a course subject."""
    school_id = context.require_any_membership().school_id

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=body.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can post tasks.",
            code="course_subject_forbidden",
        )

    task = await operations.create_task(
        session,
        school_id=school_id,
        posted_by=context.user_id,
        course_subject_id=body.course_subject_id,
        title=body.title,
        description=body.description,
        due_at=body.due_at,
        max_score=body.max_score,
    )
    await session.commit()
    return TaskOut.model_validate(task, from_attributes=True)


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(
    body: TaskUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: Annotated[uuid.UUID, Path()],
) -> TaskOut:
    """Update a task."""
    school_id = context.require_any_membership().school_id

    task = await operations.get_task(session, task_id=task_id, school_id=school_id)

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=task.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can edit it.",
            code="course_subject_forbidden",
        )

    updated = await operations.update_task(
        session,
        task_id=task_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return TaskOut.model_validate(updated, from_attributes=True)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a task."""
    school_id = context.require_any_membership().school_id

    task = await operations.get_task(session, task_id=task_id, school_id=school_id)

    if not await can_delete_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=task.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can delete it.",
            code="course_subject_forbidden",
        )

    await operations.delete_task(session, task_id=task_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------


@router.get("/submissions", response_model=list[SubmissionOut])
async def list_submissions(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[SubmissionOut]:
    """List the submissions the caller may read.

    A teacher sees the submissions of their course subjects; a school
    admin sees all of them; a student sees only their own.
    """
    school_id = context.require_any_membership().school_id
    role = context.role_in(school_id)

    if role == SchoolRole.STUDENT:
        # A student only ever sees their own submissions.
        rows = await operations.list_submissions(
            session,
            school_id=school_id,
            task_id=task_id,
            student_id=context.user_id,
        )
        return [SubmissionOut.model_validate(r, from_attributes=True) for r in rows]

    if role == SchoolRole.SCHOOL_ADMIN:
        rows = await operations.list_submissions(session, school_id=school_id, task_id=task_id)
        return [SubmissionOut.model_validate(r, from_attributes=True) for r in rows]

    # A teacher: the submissions of the course subjects they teach.
    candidate = await operations.list_submissions(session, school_id=school_id, task_id=task_id)
    visible: list[SubmissionOut] = []
    for submission in candidate:
        task = await operations.get_task(session, task_id=submission.task_id, school_id=school_id)
        if await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=task.course_subject_id,
        ):
            visible.append(SubmissionOut.model_validate(submission, from_attributes=True))
    return visible


@router.post(
    "/submissions",
    response_model=SubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_submission(
    body: SubmissionCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    task_id: Annotated[uuid.UUID, Query()],
) -> SubmissionOut:
    """Submit an answer for a task."""
    school_id = context.require_any_membership().school_id

    task = await operations.get_task(session, task_id=task_id, school_id=school_id)

    if not await can_read_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=task.course_subject_id,
    ):
        raise ForbiddenError(
            "You do not have access to this course subject.",
            code="course_subject_forbidden",
        )

    submission = await operations.create_submission(
        session,
        school_id=school_id,
        task_id=task_id,
        student_id=context.user_id,
        body=body.body,
        file_path=body.file_path,
        status=body.status,
    )
    await session.commit()
    return SubmissionOut.model_validate(submission, from_attributes=True)


@router.patch("/submissions/{submission_id}", response_model=SubmissionOut)
async def update_submission(
    body: SubmissionUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    submission_id: Annotated[uuid.UUID, Path()],
) -> SubmissionOut:
    """Edit a submission, or grade it.

    A student edits their own. A teacher of the course subject grades
    it. The two actions touch different fields, and the route keeps
    them apart: a student cannot set their own grade.
    """
    school_id = context.require_any_membership().school_id

    submission = await operations.get_submission(
        session, submission_id=submission_id, school_id=school_id
    )
    task = await operations.get_task(session, task_id=submission.task_id, school_id=school_id)

    is_owner = submission.student_id == context.user_id
    is_teacher = await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=task.course_subject_id,
    )

    if not is_owner and not is_teacher:
        raise ForbiddenError(
            "You do not have access to this submission.",
            code="submission_forbidden",
        )

    changes = _changes(body)
    if not is_teacher:
        # A student cannot grade their own work.
        forbidden = {"grade", "feedback", "graded_by", "graded_at"}
        if forbidden & set(changes):
            raise ForbiddenError(
                "Only the teacher can grade a submission.",
                code="grading_forbidden",
            )

    updated = await operations.update_submission(
        session,
        submission_id=submission_id,
        school_id=school_id,
        changes=changes,
    )

    if is_teacher and "grade" in changes and updated.graded_by is None:
        updated.graded_by = context.user_id

    await session.commit()
    return SubmissionOut.model_validate(updated, from_attributes=True)


@router.delete(
    "/submissions/{submission_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_submission(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    submission_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a submission. Only its owner can do that."""
    school_id = context.require_any_membership().school_id

    submission = await operations.get_submission(
        session, submission_id=submission_id, school_id=school_id
    )

    if submission.student_id != context.user_id:
        raise ForbiddenError(
            "Only the owner can delete a submission.",
            code="submission_forbidden",
        )

    await operations.delete_submission(session, submission_id=submission_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
