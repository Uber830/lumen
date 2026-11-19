"""Grade operations.

A grade is a student's score for a course subject in an academic
period, on the 0-to-5 Colombian scale.

The rules come from the RLS policies the migrations declared:

- **reads**: a school admin, the teacher assigned to the course
  subject, or the student the grade belongs to;
- **writes**: the assigned teacher.

One grade per (student, course subject, period): the database has a
unique constraint for it, and the write is an upsert so that recording
a grade twice updates it.
"""

from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import can_read_course_subject
from app.core.context import RequestContext
from app.core.errors import ConflictError, ForbiddenError, NotFoundError
from app.db.models import (
    AcademicPeriod,
    Course,
    CourseSubject,
    Grade,
)


async def list_grades(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
    academic_period_id: uuid.UUID | None = None,
) -> list[Grade]:
    """List the grades the caller may read."""
    statement = select(Grade).where(Grade.school_id == school_id)

    if course_subject_id is not None:
        statement = statement.where(Grade.course_subject_id == course_subject_id)
    if student_id is not None:
        statement = statement.where(Grade.student_id == student_id)
    if academic_period_id is not None:
        statement = statement.where(Grade.academic_period_id == academic_period_id)

    result = await session.execute(statement.order_by(Grade.recorded_at.desc()))
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

    # A student only ever sees their own grades. A teacher sees the
    # ones of the course subjects they teach.
    visible: list[Grade] = []
    for grade in rows:
        if grade.student_id == context.user_id:
            visible.append(grade)
            continue
        if await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=grade.course_subject_id,
        ):
            visible.append(grade)
    return visible


async def get_grade(
    session: AsyncSession,
    *,
    grade_id: uuid.UUID,
    school_id: uuid.UUID,
) -> Grade:
    """Load one grade, scoped to the school."""
    result = await session.execute(
        select(Grade).where(Grade.id == grade_id, Grade.school_id == school_id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Grade not found.")
    return row


async def record_grade(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    recorded_by: uuid.UUID,
    course_subject_id: uuid.UUID,
    student_id: uuid.UUID,
    academic_period_id: uuid.UUID,
    score: Decimal,
    notes: str | None,
) -> Grade:
    """Record a grade, replacing the previous one for the same key.

    There is one grade per (student, course subject, period). Writing
    the same one twice updates it instead of failing.
    """
    await _require_course_subject(session, school_id, course_subject_id)
    await _require_period(session, school_id, academic_period_id)

    existing = await session.execute(
        select(Grade).where(
            Grade.student_id == student_id,
            Grade.course_subject_id == course_subject_id,
            Grade.academic_period_id == academic_period_id,
        )
    )
    row = existing.scalar_one_or_none()

    if row is not None:
        row.score = score
        row.notes = notes
        row.recorded_by = recorded_by
        await session.flush()
        return row

    grade = Grade(
        id=uuid.uuid4(),
        school_id=school_id,
        course_subject_id=course_subject_id,
        student_id=student_id,
        academic_period_id=academic_period_id,
        score=score,
        notes=notes,
        recorded_by=recorded_by,
    )
    session.add(grade)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("That grade already exists.") from exc
    return grade


async def update_grade(
    session: AsyncSession,
    *,
    grade_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> Grade:
    """Apply a partial update to a grade."""
    grade = await get_grade(session, grade_id=grade_id, school_id=school_id)
    for field, value in changes.items():
        if value is not None:
            setattr(grade, field, value)
    await session.flush()
    return grade


async def delete_grade(
    session: AsyncSession,
    *,
    grade_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a grade."""
    grade = await get_grade(session, grade_id=grade_id, school_id=school_id)
    await session.delete(grade)
    await session.flush()


async def student_grade_sheet(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
) -> dict[str, object]:
    """Build the grade sheet of a student.

    The frontend used to assemble this in the browser from two
    PostgREST queries and a join. It is one server-side query now,
    grouped by course subject.
    """
    # The periods, oldest first: they are the columns of the sheet.
    periods_result = await session.execute(
        select(AcademicPeriod)
        .where(AcademicPeriod.school_id == school_id)
        .order_by(AcademicPeriod.start_date.asc())
    )
    periods = list(periods_result.scalars().all())
    period_names = {period.id: period.name for period in periods}

    # The grades, joined with the subject name.
    grades_result = await session.execute(
        select(Grade, CourseSubject, Course)
        .join(CourseSubject, CourseSubject.id == Grade.course_subject_id)
        .join(Course, Course.id == CourseSubject.course_id)
        .where(
            Grade.school_id == school_id,
            Grade.student_id == student_id,
        )
    )
    rows = grades_result.all()

    # The subject name lives on the subject behind the course subject.
    subject_names: dict[uuid.UUID, tuple[str, str | None]] = {}
    course_subject_ids = {row[1].id for row in rows}
    if course_subject_ids:
        from app.db.models import Subject

        subjects_result = await session.execute(
            select(CourseSubject.id, Subject.name, Subject.area)
            .join(Subject, Subject.id == CourseSubject.subject_id)
            .where(CourseSubject.id.in_(course_subject_ids))
        )
        subject_names = {row[0]: (row[1], row[2]) for row in subjects_result.all()}

    grouped: dict[uuid.UUID, dict[str, object]] = {}
    for grade, course_subject, _course in rows:
        entry = grouped.setdefault(
            course_subject.id,
            {
                "course_subject_id": course_subject.id,
                "subject_name": subject_names.get(course_subject.id, ("?", None))[0],
                "subject_area": subject_names.get(course_subject.id, ("?", None))[1],
                "grades": {},
            },
        )
        scores: dict[str, Decimal | None] = entry["grades"]  # type: ignore[assignment]
        scores[period_names.get(grade.academic_period_id, str(grade.academic_period_id))] = (
            grade.score
        )

    out_rows: list[dict[str, object]] = []
    for entry in grouped.values():
        entry_scores: dict[str, Decimal | None] = entry["grades"]  # type: ignore[assignment]
        values = [value for value in entry_scores.values() if value is not None]
        average = sum(values, Decimal("0")) / len(values) if values else None
        out_rows.append({**entry, "average": average})

    return {
        "rows": out_rows,
        "periods": [{"id": str(p.id), "name": p.name} for p in periods],
    }


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


async def _require_period(
    session: AsyncSession,
    school_id: uuid.UUID,
    academic_period_id: uuid.UUID,
) -> AcademicPeriod:
    """Load an academic period, scoped to the school."""
    result = await session.execute(
        select(AcademicPeriod).where(
            AcademicPeriod.id == academic_period_id,
            AcademicPeriod.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Academic period not found.")
    return row


__all__ = [
    "delete_grade",
    "get_grade",
    "list_grades",
    "record_grade",
    "student_grade_sheet",
    "update_grade",
]
