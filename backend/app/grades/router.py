"""Grades router: the scores a teacher records and a student reads.

- **reads**: a school admin, the teacher assigned to the course
  subject, or the student the grade belongs to;
- **writes**: the assigned teacher.

Recording a grade twice for the same student, course subject and
period updates it: there is one grade per that key.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import can_write_course_subject
from app.core.context import RequestContext
from app.core.errors import ForbiddenError
from app.db.session import get_db
from app.deps import get_context
from app.grades import operations
from app.grades.schemas import (
    GradeCreate,
    GradeOut,
    GradeUpdate,
    StudentGradesOut,
)

router = APIRouter(prefix="/v1/grades", tags=["grades"])


def _changes(body: BaseModel) -> dict[str, object]:
    """The fields of a partial update that were actually sent."""
    return body.model_dump(exclude_unset=True)


@router.get("", response_model=list[GradeOut])
async def list_grades(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_subject_id: Annotated[uuid.UUID | None, Query()] = None,
    student_id: Annotated[uuid.UUID | None, Query()] = None,
    academic_period_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[GradeOut]:
    """List the grades the caller may read."""
    school_id = context.require_any_membership().school_id

    # A student can only ask for their own.
    if context.role_in(school_id) == "student" and student_id not in (
        None,
        context.user_id,
    ):
        raise ForbiddenError(
            "You can only read your own grades.",
            code="grades_forbidden",
        )

    grades = await operations.list_grades(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=course_subject_id,
        student_id=student_id,
        academic_period_id=academic_period_id,
    )
    return [GradeOut.model_validate(g, from_attributes=True) for g in grades]


@router.post("", response_model=GradeOut, status_code=status.HTTP_201_CREATED)
async def record_grade(
    body: GradeCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> GradeOut:
    """Record a grade.

    Writing a grade that already exists for the same student, course
    subject and period updates it.
    """
    school_id = context.require_any_membership().school_id

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=body.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can record grades.",
            code="course_subject_forbidden",
        )

    grade = await operations.record_grade(
        session,
        school_id=school_id,
        recorded_by=context.user_id,
        course_subject_id=body.course_subject_id,
        student_id=body.student_id,
        academic_period_id=body.academic_period_id,
        score=body.score,
        notes=body.notes,
    )
    await session.commit()
    return GradeOut.model_validate(grade, from_attributes=True)


@router.patch("/{grade_id}", response_model=GradeOut)
async def update_grade(
    body: GradeUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    grade_id: Annotated[uuid.UUID, Path()],
) -> GradeOut:
    """Update a grade."""
    school_id = context.require_any_membership().school_id

    grade = await operations.get_grade(session, grade_id=grade_id, school_id=school_id)

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=grade.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can edit grades.",
            code="course_subject_forbidden",
        )

    updated = await operations.update_grade(
        session,
        grade_id=grade_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return GradeOut.model_validate(updated, from_attributes=True)


@router.delete("/{grade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_grade(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    grade_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a grade."""
    school_id = context.require_any_membership().school_id

    grade = await operations.get_grade(session, grade_id=grade_id, school_id=school_id)

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=grade.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can delete grades.",
            code="course_subject_forbidden",
        )

    await operations.delete_grade(session, grade_id=grade_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/students/{student_id}", response_model=StudentGradesOut)
async def student_grade_sheet(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    student_id: Annotated[uuid.UUID, Path()],
) -> StudentGradesOut:
    """The grade sheet of a student.

    The frontend used to assemble this in the browser from two
    PostgREST queries and a join. It is one server-side query now.
    """
    school_id = context.require_any_membership().school_id

    if student_id != context.user_id and not await _can_read_student_grades(
        session, context=context, school_id=school_id, student_id=student_id
    ):
        raise ForbiddenError(
            "You do not have access to this student's grades.",
            code="grades_forbidden",
        )

    sheet = await operations.student_grade_sheet(
        session, school_id=school_id, student_id=student_id
    )
    return StudentGradesOut.model_validate(sheet)


async def _can_read_student_grades(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
) -> bool:
    """True when the caller may read a student's grades.

    A school admin can. A teacher can, for the course subjects they
    teach. The student can read their own.
    """
    from app.core.access import can_read_course_subject
    from app.db.models import Grade

    result = await session.execute(
        select(Grade.course_subject_id)
        .where(Grade.school_id == school_id, Grade.student_id == student_id)
        .distinct()
    )
    course_subject_ids = list(result.scalars().all())

    for course_subject_id in course_subject_ids:
        if await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=course_subject_id,
        ):
            return True
    return False


__all__ = ["router"]
