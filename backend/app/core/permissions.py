"""Permission checks: the Python port of the SQL helper functions.

Until now, Row Level Security was the only thing standing between one
school's data and another's. With the CRUD moving into this backend,
RLS is no longer in the path, so every check the policies relied on
has to live here instead.

These functions are the port of the seven `SECURITY DEFINER`
helpers the migrations declared:

| SQL                                    | Python                              |
| -------------------------------------- | ----------------------------------- |
| `is_school_member(school_id)`          | `is_school_member`                  |
| `has_school_role(school_id, role)`     | `has_school_role`                   |
| `is_platform_admin()`                  | `is_platform_admin`                 |
| `is_course_subject_teacher(...)`      | `is_course_subject_teacher`         |
| `is_course_student(...)`               | `is_course_student`                 |
| `school_has_icfes(school_id)`          | `school_has_icfes`                  |
| `bootstrap_school(...)`                | `app.schools.operations`            |

The behaviour is preserved exactly, including the subtle parts:

- A membership counts only when it is not revoked.
- An enrollment counts only when its status is `active`.
- The ICFES entitlement counts only when the subscription status is
  `active` or `trial`.
- A platform admin is a global role, separate from any school
  membership.

Every function takes the `RequestContext` rather than reading
`auth.uid()`: the caller is already known, and reading it from a
global would make the functions impossible to test and impossible to
call on behalf of someone else.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import EnrollmentStatus, SchoolRole, SubscriptionStatus
from app.db.models import (
    Entitlement,
    PlatformRole,
    SchoolMembership,
    StudentEnrollment,
    TeacherAssignment,
)

# The subscription statuses that entitle a school to a feature.
# Mirrors the `status in ('active', 'trial')` filter the SQL helper
# used.
ENTITLED_SUBSCRIPTION_STATUSES = (
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIAL,
)


async def is_school_member(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
) -> bool:
    """True when the user has an active membership in the school."""
    result = await session.execute(
        select(SchoolMembership.id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.user_id == user_id,
            SchoolMembership.revoked_at.is_(None),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def has_school_role(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    role: SchoolRole,
) -> bool:
    """True when the user holds the given role in the school."""
    result = await session.execute(
        select(SchoolMembership.id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.user_id == user_id,
            SchoolMembership.role == role,
            SchoolMembership.revoked_at.is_(None),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def has_any_school_role(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    roles: tuple[SchoolRole, ...],
) -> bool:
    """True when the user holds any of the given roles in the school."""
    if not roles:
        return False
    result = await session.execute(
        select(SchoolMembership.id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.user_id == user_id,
            SchoolMembership.role.in_(roles),
            SchoolMembership.revoked_at.is_(None),
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def is_platform_admin(session: AsyncSession, *, user_id: uuid.UUID) -> bool:
    """True when the user holds the global platform_admin role."""
    result = await session.execute(
        select(PlatformRole.user_id)
        .where(
            PlatformRole.user_id == user_id,
            PlatformRole.role == "platform_admin",
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def is_course_subject_teacher(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> bool:
    """True when the teacher is assigned to the course subject."""
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


async def is_course_student(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
    course_id: uuid.UUID,
) -> bool:
    """True when the student has an active enrollment in the course."""
    result = await session.execute(
        select(StudentEnrollment.id)
        .where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.course_id == course_id,
            StudentEnrollment.student_id == user_id,
            StudentEnrollment.status == EnrollmentStatus.ACTIVE,
        )
        .limit(1)
    )
    return result.scalar_one_or_none() is not None


async def school_has_icfes(session: AsyncSession, *, school_id: uuid.UUID) -> bool:
    """True when the school's entitlement includes ICFES.

    The entitlement only counts when the subscription is active or on
    trial: a cancelled or expired subscription does not entitle the
    school to anything.
    """
    result = await session.execute(
        select(Entitlement.includes_icfes).where(
            Entitlement.school_id == school_id,
            Entitlement.status.in_(ENTITLED_SUBSCRIPTION_STATUSES),
        )
    )
    includes = result.scalar_one_or_none()
    return bool(includes)


async def active_entitlement(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
) -> Entitlement | None:
    """Return the school's entitlement when it entitles anything."""
    result = await session.execute(
        select(Entitlement).where(
            Entitlement.school_id == school_id,
            Entitlement.status.in_(ENTITLED_SUBSCRIPTION_STATUSES),
        )
    )
    return result.scalar_one_or_none()


async def count_school_members(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    role: SchoolRole,
) -> int:
    """Count the active members of a school with the given role."""
    result = await session.execute(
        select(func.count(SchoolMembership.id)).where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == role,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    return int(result.scalar_one())


__all__ = [
    "ENTITLED_SUBSCRIPTION_STATUSES",
    "active_entitlement",
    "count_school_members",
    "has_any_school_role",
    "has_school_role",
    "is_course_student",
    "is_course_subject_teacher",
    "is_platform_admin",
    "is_school_member",
    "school_has_icfes",
]
