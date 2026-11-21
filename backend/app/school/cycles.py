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
from typing import Any

from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    Course,
    CourseSubject,
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


async def list_assignments(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    teacher_id: uuid.UUID | None = None,
    course_id: uuid.UUID | None = None,
) -> list[dict[str, Any]]:
    """The assignments of the school, with the material each one sees.

    The count of visible material is computed in the database: it is the
    published material of the area of the subject, enabled for the
    school, that applies to the course of the assignment (or to the whole
    school, when the material has no course of its own).
    """
    statement = (
        select(
            TeacherAssignment.id,
            TeacherAssignment.teacher_id,
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

    return assignments




__all__ = [
    "list_assignments",
]
