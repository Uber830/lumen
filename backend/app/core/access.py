"""Course-subject access checks.

The content, task and evaluation modules share one rule set, and it
is finer-grained than the academic one. A member of the school is
not enough: the access depends on the *course subject* the resource
belongs to.

The rules come from the RLS policies the migrations declared:

**Reading** a content item or a task requires one of:

- being a school admin;
- being the teacher assigned to the course subject;
- being a student enrolled in the course the course subject belongs
  to.

**Writing** requires one of:

- being a school admin (for deletion only);
- being the teacher assigned to the course subject.

**A submission** belongs to the student who made it. The student can
read and update their own; the teacher of the course subject can read
and grade it; a school admin can read it.

The helpers here answer those questions. They take the school id and
the course subject id, and they are used by every module that has to
make the same decision.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.db.enums import SchoolRole
from app.db.models import CourseSubject, StudentEnrollment, TeacherAssignment


async def course_subject_course_id(
    session: AsyncSession,
    *,
    course_subject_id: uuid.UUID,
) -> uuid.UUID | None:
    """The course a course subject belongs to.

    Returns None when the course subject does not exist.
    """
    result = await session.execute(
        select(CourseSubject.course_id).where(CourseSubject.id == course_subject_id)
    )
    return result.scalar_one_or_none()


async def is_course_subject_teacher(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> bool:
    """True when the user teaches the course subject."""
    result = await session.execute(
        select(TeacherAssignment.id)
        .where(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.course_subject_id == course_subject_id,
            TeacherAssignment.teacher_id == user_id,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def is_course_subject_student(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> bool:
    """True when the user is enrolled in the course the subject belongs to.

    The enrollment has to be active: a withdrawn student does not
    count.
    """
    course_id = await course_subject_course_id(session, course_subject_id=course_subject_id)
    if course_id is None:
        return False

    result = await session.execute(
        select(StudentEnrollment.id)
        .where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.course_id == course_id,
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.status == "active",
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def can_read_course_subject(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> bool:
    """True when the caller may read the resources of a course subject.

    The rules mirror the `*_select` policies: a school admin, the
    assigned teacher, or an enrolled student.
    """
    if context.role_in(school_id) == SchoolRole.SCHOOL_ADMIN:
        return True
    if context.is_platform_admin:
        return True
    if await is_course_subject_teacher(
        session,
        user_id=context.user_id,
        school_id=school_id,
        course_subject_id=course_subject_id,
    ):
        return True
    return await is_course_subject_student(
        session,
        user_id=context.user_id,
        school_id=school_id,
        course_subject_id=course_subject_id,
    )


async def can_write_course_subject(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> bool:
    """True when the caller may create resources in a course subject.

    The rules mirror the `*_teacher_write` policies: the assigned
    teacher, or a platform admin.
    """
    if context.is_platform_admin:
        return True
    return await is_course_subject_teacher(
        session,
        user_id=context.user_id,
        school_id=school_id,
        course_subject_id=course_subject_id,
    )


async def can_delete_course_subject(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> bool:
    """True when the caller may delete resources of a course subject.

    The rules mirror the `*_teacher_delete` policies: the assigned
    teacher, a school admin, or a platform admin.
    """
    if context.is_platform_admin:
        return True
    if context.role_in(school_id) == SchoolRole.SCHOOL_ADMIN:
        return True
    return await is_course_subject_teacher(
        session,
        user_id=context.user_id,
        school_id=school_id,
        course_subject_id=course_subject_id,
    )


__all__ = [
    "can_delete_course_subject",
    "can_read_course_subject",
    "can_write_course_subject",
    "course_subject_course_id",
    "is_course_subject_student",
    "is_course_subject_teacher",
]
