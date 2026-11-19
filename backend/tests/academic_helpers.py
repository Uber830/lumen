"""Helpers for the academic tests.

The academic module is exercised through the HTTP API, so the tests
need a school with members in every role and a token for each of
them.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.enums import SchoolRole
from app.db.models import (
    Course,
    CourseSubject,
    Entitlement,
    Profile,
    School,
    SchoolMembership,
    Subject,
    User,
)


@dataclass(frozen=True, slots=True)
class SchoolFixture:
    """A school with one member per role."""

    school_id: uuid.UUID
    admin_id: uuid.UUID
    teacher_id: uuid.UUID
    student_id: uuid.UUID


async def seed_school_with_members(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    prefix: str = "AC",
) -> SchoolFixture:
    """Create a school with a school admin, a teacher and a student.

    Every row is committed: the API reads through its own connection,
    so a fixture-scoped transaction would be invisible to it.
    """
    school_id = uuid.uuid4()
    admin_id = uuid.uuid4()
    teacher_id = uuid.uuid4()
    student_id = uuid.uuid4()

    async with session_factory() as session:
        session.add(
            School(
                id=school_id,
                name=f"Colegio {prefix} {school_id.hex[:8]}",
                short_code=f"{prefix}{school_id.hex[:6].upper()}",
                status="active",
            )
        )
        # Flush the school before the rows that reference it: the
        # models carry plain foreign keys, so SQLAlchemy cannot infer
        # the insert order.
        await session.flush()

        session.add(
            Entitlement(
                school_id=school_id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status="active",
            )
        )

        for user_id, role, name in (
            (admin_id, SchoolRole.SCHOOL_ADMIN, "Admin"),
            (teacher_id, SchoolRole.TEACHER, "Teacher"),
            (student_id, SchoolRole.STUDENT, "Student"),
        ):
            session.add(
                User(
                    id=user_id,
                    email=f"{prefix}-{role.value}-{user_id.hex[:8]}@example.com",
                    password_hash="",
                    full_name=name,
                )
            )
            session.add(Profile(id=user_id, full_name=name))
            session.add(
                SchoolMembership(
                    id=uuid.uuid4(),
                    school_id=school_id,
                    user_id=user_id,
                    role=role,
                    is_primary=True,
                    joined_at=datetime.now(UTC),
                )
            )

        await session.commit()

    return SchoolFixture(
        school_id=school_id,
        admin_id=admin_id,
        teacher_id=teacher_id,
        student_id=student_id,
    )


async def seed_course_and_subject(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    school_id: uuid.UUID,
    course_name: str = "10mo A",
    subject_name: str = "Matematicas",
) -> tuple[uuid.UUID, uuid.UUID]:
    """Create a course and a subject, without the join.

    Some tests need to offer the subject themselves, to check that
    offering the same subject twice is refused.
    """
    course_id = uuid.uuid4()
    subject_id = uuid.uuid4()

    async with session_factory() as session:
        session.add(
            Course(
                id=course_id,
                school_id=school_id,
                name=course_name,
                grade_label="10",
            )
        )
        session.add(
            Subject(
                id=subject_id,
                school_id=school_id,
                name=subject_name,
                area="Matematicas",
            )
        )
        await session.commit()

    return course_id, subject_id


async def seed_course_subject(
    session_factory: async_sessionmaker[AsyncSession],
    *,
    school_id: uuid.UUID,
    course_name: str = "10mo A",
    subject_name: str = "Matematicas",
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """Create a course, a subject and the join. Returns their ids."""
    course_id = uuid.uuid4()
    subject_id = uuid.uuid4()
    course_subject_id = uuid.uuid4()

    async with session_factory() as session:
        session.add(
            Course(
                id=course_id,
                school_id=school_id,
                name=course_name,
                grade_label="10",
            )
        )
        session.add(
            Subject(
                id=subject_id,
                school_id=school_id,
                name=subject_name,
                area="Matematicas",
            )
        )
        # Flush before the join: the models carry plain foreign keys,
        # so SQLAlchemy cannot infer the insert order.
        await session.flush()

        session.add(
            CourseSubject(
                id=course_subject_id,
                school_id=school_id,
                course_id=course_id,
                subject_id=subject_id,
            )
        )
        await session.flush()
        await session.commit()

    return course_id, subject_id, course_subject_id


__all__ = [
    "SchoolFixture",
    "seed_course_and_subject",
    "seed_course_subject",
    "seed_school_with_members",
]
