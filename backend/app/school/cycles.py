"""The academic cycle of the school: its assignments and its periods.

Two things live here, and they are the two ends of the same chain:

- an **assignment** ties a teacher to a course subject. It is what
  enables the access to the content: without an assignment the teacher
  has no course, and without a course there is nothing to see.
- a **period** is the cycle of the school. It has one current period at
  a time, and closing it takes the material of the cycle out of the
  active material: it stays as history.

The material a teacher sees through an assignment is **counted, not
guessed**: it is the published material of the area of the subject,
enabled for the school, that applies to one of the courses of the
teacher.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.db.models import (
    AcademicPeriod,
    Course,
    CourseSubject,
    Grade,
    Material,
    MaterialCourse,
    MaterialSchool,
    Profile,
    Subject,
    TeacherAssignment,
    User,
)

# The state of a material that a school can see. A draft or a review
# one is not part of the enabled material.
PUBLISHED_STATE = "publicado"

# The status of a period, as the panel reads it.
STATUS_CURRENT = "vigente"
STATUS_CLOSED = "cerrado"
STATUS_FUTURE = "future"


async def list_assignments(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    teacher_id: uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
    page: int | None = None,
    per_page: int = 10,
) -> tuple[list[dict[str, Any]], int]:
    """The assignments of the school, with the material each one sees.

    The count of visible material is computed in the database: it is the
    published material of the area of the subject, enabled for the
    school, that applies to the course of the assignment (or to the whole
    school, when the material has no course of its own).

    The rows are the teachers, not the assignments: the person is the
    one that repeats, and what matters is what each one teaches. When a
    page is asked for, only the teachers of that page come back, with
    the total count of teachers.
    """
    statement = (
        select(
            TeacherAssignment.id,
            TeacherAssignment.teacher_id,
            # The course subject is the assignment itself: the form needs it
            # to edit the row without losing the link.
            TeacherAssignment.course_subject_id,
            # The name lives in the profile when the account has one, and
            # in the user otherwise.
            func.coalesce(Profile.full_name, User.full_name),
            User.email,
            Profile.avatar_url,
            Course.id,
            Course.name,
            Subject.id,
            Subject.name,
            Subject.area,
        )
        .join(CourseSubject, CourseSubject.id == TeacherAssignment.course_subject_id)
        .join(Course, Course.id == CourseSubject.course_id)
        .join(Subject, Subject.id == CourseSubject.subject_id)
        .outerjoin(Profile, Profile.id == TeacherAssignment.teacher_id)
        .join(User, User.id == TeacherAssignment.teacher_id)
        .where(
            TeacherAssignment.school_id == school_id,
            CourseSubject.school_id == school_id,
        )
    )

    if teacher_id is not None:
        statement = statement.where(TeacherAssignment.teacher_id == teacher_id)
    if course_id is not None:
        statement = statement.where(Course.id == course_id)

    result = await session.execute(
        statement.order_by(
            func.coalesce(Profile.full_name, User.full_name).asc(),
            Course.name.asc(),
            Subject.name.asc(),
        )
    )

    assignments = []
    for row in result.all():
        (
            assignment_id,
            teacher_id,
            course_subject_id,
            full_name,
            email,
            avatar_url,
            course_id,
            course_name,
            subject_id,
            subject_name,
            subject_area,
        ) = row
        visible = await _visible_material_count(
            session,
            school_id=school_id,
            course_id=course_id,
            area=subject_area,
        )
        assignments.append(
            {
                "id": str(assignment_id),
                "teacher_id": str(teacher_id),
                "course_subject_id": str(course_subject_id),
                "teacher_name": full_name,
                "teacher_email": email,
                "teacher_avatar_url": avatar_url,
                "course_id": str(course_id),
                "course_name": course_name,
                "subject_id": str(subject_id),
                "subject_name": subject_name,
                "subject_area": subject_area,
                "visible_materials_count": visible,
            }
        )

    # The rows are the teachers: the assignments of each one travel
    # inside its row, so the person is not repeated.
    groups: dict[str, dict[str, Any]] = {}
    for assignment in assignments:
        group = groups.setdefault(
            assignment["teacher_id"],
            {
                "teacher_id": assignment["teacher_id"],
                "teacher_name": assignment["teacher_name"],
                "teacher_email": assignment["teacher_email"],
                "teacher_avatar_url": assignment["teacher_avatar_url"],
                "assignments": [],
                "visible_materials_count": 0,
            },
        )
        group["assignments"].append(assignment)
        group["visible_materials_count"] += int(assignment["visible_materials_count"])

    rows = list(groups.values())
    total = len(rows)

    if page is not None:
        start = (max(page, 1) - 1) * per_page
        rows = rows[start : start + per_page]

    return rows, total


async def _visible_material_count(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    course_id: uuid.UUID,
    area: str | None,
) -> int:
    """How many pieces of material a teacher sees through an assignment.

    Three conditions at once: the material is published, it is enabled
    for this school and it has not been archived by a closed period, and
    it applies to the course of the assignment (or to the whole school,
    when it has no course of its own).
    """
    if not area:
        return 0

    applies_to_course = select(MaterialCourse.material_id).where(
        MaterialCourse.course_id == course_id
    )
    applies_to_nobody = select(MaterialCourse.material_id).where(
        MaterialCourse.material_id == Material.id
    )

    statement = (
        select(func.count(distinct(Material.id)))
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            MaterialSchool.archived_at.is_(None),
            Material.state == PUBLISHED_STATE,
            Material.area == area,
            # The material applies to the course of the assignment, or it
            # applies to no course at all: then it is the school's.
            Material.id.in_(applies_to_course) | ~Material.id.in_(applies_to_nobody),
        )
    )

    result = await session.execute(statement)
    return int(result.scalar() or 0)


async def list_periods(session: AsyncSession, school_id: uuid.UUID) -> list[dict[str, Any]]:
    """The periods of the school, the current one first.

    The status is computed: a period is vigente when it is the current
    one, cerrado when it was closed, and future when it has not started.
    """
    result = await session.execute(
        select(AcademicPeriod)
        .where(AcademicPeriod.school_id == school_id)
        .order_by(AcademicPeriod.start_date.desc())
    )

    today = datetime.now(UTC).date()
    periods = []
    for period in result.scalars().all():
        if period.closed_at is not None:
            status = STATUS_CLOSED
        elif period.is_current:
            status = STATUS_CURRENT
        elif period.start_date > today:
            status = STATUS_FUTURE
        else:
            status = STATUS_CLOSED

        periods.append(
            {
                "id": str(period.id),
                "name": period.name,
                "start_date": period.start_date,
                "end_date": period.end_date,
                "modality": period.modality.value,
                "delivery_modality": (
                    period.delivery_modality.value if period.delivery_modality else None
                ),
                "status": status,
                "is_current": period.is_current,
                "closed_at": period.closed_at,
            }
        )

    # The current period comes first, and the rest from the newest to the
    # oldest.
    periods.sort(
        key=lambda period: (period["status"] != STATUS_CURRENT, period["start_date"]), reverse=False
    )
    periods.sort(key=lambda period: period["status"] != STATUS_CURRENT)
    return periods


async def close_period(
    session: AsyncSession,
    school_id: uuid.UUID,
    period_id: uuid.UUID,
) -> dict[str, Any]:
    """Close a period of the school.

    In one transaction: the period is closed, it stops being the current
    one, and the material of the cycle is archived for the school. The
    material stays in the database: it is history, not active material.
    """
    period = await _period_of(session, school_id, period_id)

    if period.closed_at is not None:
        raise ConflictError("Este periodo ya está cerrado.")

    now = datetime.now(UTC)
    period.closed_at = now
    period.is_current = False

    archived = await _archive_cycle_material(session, school_id=school_id, period=period)
    await session.commit()

    return {
        "id": str(period.id),
        "name": period.name,
        "closed_at": period.closed_at,
        "archived_materials": archived,
    }


async def set_current_period(
    session: AsyncSession,
    school_id: uuid.UUID,
    period_id: uuid.UUID,
) -> dict[str, Any]:
    """Mark a period as the current one.

    The previous current period is closed in the same transaction: a
    school has one current period at a time, and the cycle that ends
    takes its material with it.
    """
    period = await _period_of(session, school_id, period_id)

    if period.closed_at is not None:
        raise ConflictError("Este periodo ya está cerrado.")

    result = await session.execute(
        select(AcademicPeriod).where(
            AcademicPeriod.school_id == school_id,
            AcademicPeriod.is_current.is_(True),
            AcademicPeriod.id != period_id,
        )
    )
    previous = result.scalars().all()

    now = datetime.now(UTC)
    for old in previous:
        old.is_current = False
        old.closed_at = now
        await _archive_cycle_material(session, school_id=school_id, period=old)

    period.is_current = True
    await session.commit()

    return {
        "id": str(period.id),
        "name": period.name,
        "closed_previous": [str(old.id) for old in previous],
    }


async def _period_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    period_id: uuid.UUID,
) -> AcademicPeriod:
    """Load one period of the school."""
    result = await session.execute(
        select(AcademicPeriod).where(
            AcademicPeriod.id == period_id,
            AcademicPeriod.school_id == school_id,
        )
    )
    period = result.scalar_one_or_none()
    if period is None:
        raise NotFoundError("Period not found.")
    return period


async def _archive_cycle_material(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    period: AcademicPeriod,
) -> int:
    """Archive the material of the cycle for the school.

    The courses of the period are the ones with grades in it: that is
    what the school worked on during the cycle. The material that
    applies to those courses is archived for this school, and only for
    this school: the catalog of the platform does not change.
    """
    course_subject_ids = select(distinct(Grade.course_subject_id)).where(
        Grade.school_id == school_id,
        Grade.academic_period_id == period.id,
    )

    # The material that applies to the courses of the cycle. The
    # material without a course of its own is the standing material of
    # the school: it does not belong to this cycle and stays active.
    material_ids = (
        select(MaterialCourse.material_id)
        .join(CourseSubject, CourseSubject.course_id == MaterialCourse.course_id)
        .where(CourseSubject.id.in_(course_subject_ids))
    )

    result = await session.execute(
        select(MaterialSchool).where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            MaterialSchool.archived_at.is_(None),
            MaterialSchool.material_id.in_(material_ids),
        )
    )

    rows = result.scalars().all()
    now = datetime.now(UTC)
    for row in rows:
        row.archived_at = now

    await session.flush()
    return len(rows)


__all__ = [
    "STATUS_CLOSED",
    "STATUS_CURRENT",
    "STATUS_FUTURE",
    "close_period",
    "list_assignments",
    "list_periods",
    "set_current_period",
]
