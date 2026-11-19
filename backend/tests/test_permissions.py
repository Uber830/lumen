"""The permission layer: the port of the SQL helper functions.

These tests are the Python equivalent of the RLS policies. They
check each helper against the exact behaviour the SQL version had,
including the subtle parts:

- a revoked membership grants nothing;
- a withdrawn enrollment is not an active enrollment;
- a cancelled subscription does not entitle a school to a feature;
- a platform admin is a global role, separate from any membership.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import (
    active_entitlement,
    count_school_members,
    has_any_school_role,
    has_school_role,
    is_course_student,
    is_course_subject_teacher,
    is_platform_admin,
    is_school_member,
    school_has_icfes,
)
from app.db.enums import EnrollmentStatus, SchoolRole, SubscriptionStatus
from app.db.models import (
    Course,
    CourseSubject,
    Entitlement,
    PlatformRole,
    School,
    SchoolMembership,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
    User,
)

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _seed_user(session: AsyncSession, email: str | None = None) -> User:
    """Create a user."""
    user = User(
        id=uuid.uuid4(),
        email=email or f"u-{uuid.uuid4().hex[:8]}@example.com",
        password_hash="",
        full_name="U",
    )
    session.add(user)
    await session.commit()
    return user


async def _seed_school(session: AsyncSession) -> School:
    """Create a school."""
    school = School(
        id=uuid.uuid4(),
        name=f"Colegio {uuid.uuid4().hex[:8]}",
        short_code=f"P{uuid.uuid4().hex[:6].upper()}",
        status="active",
    )
    session.add(school)
    await session.commit()
    return school


async def _seed_membership(
    session: AsyncSession,
    *,
    user: User,
    school: School,
    role: SchoolRole,
    is_primary: bool = True,
    revoked: bool = False,
) -> SchoolMembership:
    """Create a membership."""
    membership = SchoolMembership(
        id=uuid.uuid4(),
        school_id=school.id,
        user_id=user.id,
        role=role,
        is_primary=is_primary,
        revoked_at=datetime.now(UTC) if revoked else None,
    )
    session.add(membership)
    await session.commit()
    return membership


# ---------------------------------------------------------------------------
# is_school_member
# ---------------------------------------------------------------------------


async def test_is_school_member_true_for_an_active_membership(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(session, user=user, school=school, role=SchoolRole.STUDENT)

        assert await is_school_member(session, user_id=user.id, school_id=school.id) is True


async def test_is_school_member_false_for_a_revoked_membership(engine):
    """A revoked membership grants nothing."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(
            session, user=user, school=school, role=SchoolRole.STUDENT, revoked=True
        )

        assert await is_school_member(session, user_id=user.id, school_id=school.id) is False


async def test_is_school_member_false_for_another_school(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        other = await _seed_school(session)
        await _seed_membership(session, user=user, school=school, role=SchoolRole.STUDENT)

        assert await is_school_member(session, user_id=user.id, school_id=other.id) is False


async def test_is_school_member_false_for_another_user(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        someone_else = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(session, user=user, school=school, role=SchoolRole.STUDENT)

        assert (
            await is_school_member(session, user_id=someone_else.id, school_id=school.id) is False
        )


# ---------------------------------------------------------------------------
# has_school_role
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "role",
    [SchoolRole.SCHOOL_ADMIN, SchoolRole.TEACHER, SchoolRole.STUDENT],
)
async def test_has_school_role_true_for_the_matching_role(engine, role):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(session, user=user, school=school, role=role)

        assert (
            await has_school_role(session, user_id=user.id, school_id=school.id, role=role) is True
        )


async def test_has_school_role_false_for_a_different_role(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(session, user=user, school=school, role=SchoolRole.TEACHER)

        assert (
            await has_school_role(
                session, user_id=user.id, school_id=school.id, role=SchoolRole.SCHOOL_ADMIN
            )
            is False
        )


async def test_has_school_role_false_for_a_revoked_membership(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(
            session,
            user=user,
            school=school,
            role=SchoolRole.SCHOOL_ADMIN,
            revoked=True,
        )

        assert (
            await has_school_role(
                session, user_id=user.id, school_id=school.id, role=SchoolRole.SCHOOL_ADMIN
            )
            is False
        )


async def test_has_any_school_role(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(session, user=user, school=school, role=SchoolRole.TEACHER)

        assert (
            await has_any_school_role(
                session,
                user_id=user.id,
                school_id=school.id,
                roles=(SchoolRole.SCHOOL_ADMIN, SchoolRole.TEACHER),
            )
            is True
        )
        assert (
            await has_any_school_role(
                session,
                user_id=user.id,
                school_id=school.id,
                roles=(SchoolRole.SCHOOL_ADMIN,),
            )
            is False
        )
        assert (
            await has_any_school_role(
                session,
                user_id=user.id,
                school_id=school.id,
                roles=(),
            )
            is False
        )


# ---------------------------------------------------------------------------
# is_platform_admin
# ---------------------------------------------------------------------------


async def test_is_platform_admin_true_with_the_role(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        session.add(PlatformRole(user_id=user.id, role="platform_admin"))
        await session.commit()

        assert await is_platform_admin(session, user_id=user.id) is True


async def test_is_platform_admin_false_without_the_role(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)

        assert await is_platform_admin(session, user_id=user.id) is False


async def test_a_school_admin_is_not_a_platform_admin(engine):
    """The two roles are separate.

    A school admin administers their own school. They do not get the
    global metrics or the cross-tenant view.
    """
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        await _seed_membership(session, user=user, school=school, role=SchoolRole.SCHOOL_ADMIN)

        assert await is_platform_admin(session, user_id=user.id) is False


# ---------------------------------------------------------------------------
# is_course_subject_teacher
# ---------------------------------------------------------------------------


async def test_is_course_subject_teacher(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        course_subject = await _seed_course_subject(session, school)

        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school.id,
                course_subject_id=course_subject.id,
                teacher_id=user.id,
            )
        )
        await session.commit()

        assert (
            await is_course_subject_teacher(
                session,
                user_id=user.id,
                school_id=school.id,
                course_subject_id=course_subject.id,
            )
            is True
        )


async def test_is_course_subject_teacher_false_for_another_subject(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        assigned = await _seed_course_subject(session, school)
        other = await _seed_course_subject(
            session,
            school,
            course_name="10mo B",
            subject_name="Fisica",
        )

        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school.id,
                course_subject_id=assigned.id,
                teacher_id=user.id,
            )
        )
        await session.commit()

        assert (
            await is_course_subject_teacher(
                session,
                user_id=user.id,
                school_id=school.id,
                course_subject_id=other.id,
            )
            is False
        )


async def test_is_course_subject_teacher_false_for_another_school(engine):
    """An assignment in one school does not carry over to another."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        other_school = await _seed_school(session)
        course_subject = await _seed_course_subject(session, school)

        session.add(
            TeacherAssignment(
                id=uuid.uuid4(),
                school_id=school.id,
                course_subject_id=course_subject.id,
                teacher_id=user.id,
            )
        )
        await session.commit()

        assert (
            await is_course_subject_teacher(
                session,
                user_id=user.id,
                school_id=other_school.id,
                course_subject_id=course_subject.id,
            )
            is False
        )


async def _seed_course_subject(
    session: AsyncSession,
    school: School,
    *,
    course_name: str = "10mo A",
    subject_name: str = "Matematicas",
) -> CourseSubject:
    """Create a course subject with its course and subject.

    The names have to be unique within the school, so the caller can
    pass distinct ones when it needs two course subjects.
    """
    course = Course(
        id=uuid.uuid4(),
        school_id=school.id,
        name=course_name,
        grade_label="10",
    )
    subject = Subject(
        id=uuid.uuid4(),
        school_id=school.id,
        name=subject_name,
    )
    session.add_all([course, subject])
    await session.flush()

    course_subject = CourseSubject(
        id=uuid.uuid4(),
        school_id=school.id,
        course_id=course.id,
        subject_id=subject.id,
    )
    session.add(course_subject)
    await session.commit()
    return course_subject


# ---------------------------------------------------------------------------
# is_course_student
# ---------------------------------------------------------------------------


async def test_is_course_student(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        course = Course(
            id=uuid.uuid4(),
            school_id=school.id,
            name="10mo A",
            grade_label="10",
        )
        session.add(course)
        await session.flush()

        session.add(
            StudentEnrollment(
                id=uuid.uuid4(),
                school_id=school.id,
                course_id=course.id,
                student_id=user.id,
                status=EnrollmentStatus.ACTIVE,
            )
        )
        await session.commit()

        assert (
            await is_course_student(
                session, user_id=user.id, school_id=school.id, course_id=course.id
            )
            is True
        )


async def test_is_course_student_false_for_a_withdrawn_enrollment(engine):
    """Only an active enrollment counts."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        course = Course(
            id=uuid.uuid4(),
            school_id=school.id,
            name="10mo A",
            grade_label="10",
        )
        session.add(course)
        await session.flush()

        session.add(
            StudentEnrollment(
                id=uuid.uuid4(),
                school_id=school.id,
                course_id=course.id,
                student_id=user.id,
                status=EnrollmentStatus.WITHDRAWN,
            )
        )
        await session.commit()

        assert (
            await is_course_student(
                session, user_id=user.id, school_id=school.id, course_id=course.id
            )
            is False
        )


async def test_is_course_student_false_for_another_course(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        school = await _seed_school(session)
        course = Course(
            id=uuid.uuid4(),
            school_id=school.id,
            name="10mo A",
            grade_label="10",
        )
        other = Course(
            id=uuid.uuid4(),
            school_id=school.id,
            name="10mo B",
            grade_label="10",
        )
        session.add_all([course, other])
        await session.flush()

        session.add(
            StudentEnrollment(
                id=uuid.uuid4(),
                school_id=school.id,
                course_id=course.id,
                student_id=user.id,
                status=EnrollmentStatus.ACTIVE,
            )
        )
        await session.commit()

        assert (
            await is_course_student(
                session, user_id=user.id, school_id=school.id, course_id=other.id
            )
            is False
        )


# ---------------------------------------------------------------------------
# school_has_icfes
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "status",
    [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
)
async def test_school_has_icfes_true_for_an_entitled_status(engine, status):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        school = await _seed_school(session)
        session.add(
            Entitlement(
                school_id=school.id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status=status,
            )
        )
        await session.commit()

        assert await school_has_icfes(session, school_id=school.id) is True


@pytest.mark.parametrize(
    "status",
    [
        SubscriptionStatus.CANCELLED,
        SubscriptionStatus.EXPIRED,
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.PENDING,
    ],
)
async def test_school_has_icfes_false_for_the_other_statuses(engine, status):
    """A cancelled or expired subscription entitles the school to nothing.

    This is the subtle part of the SQL helper: the entitlement counts
    only when the status is active or trial.
    """
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        school = await _seed_school(session)
        session.add(
            Entitlement(
                school_id=school.id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status=status,
            )
        )
        await session.commit()

        assert await school_has_icfes(session, school_id=school.id) is False


async def test_school_has_icfes_false_when_the_plan_excludes_it(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        school = await _seed_school(session)
        session.add(
            Entitlement(
                school_id=school.id,
                plan_code="basico",
                plan_name="Basico",
                includes_icfes=False,
                status=SubscriptionStatus.ACTIVE,
            )
        )
        await session.commit()

        assert await school_has_icfes(session, school_id=school.id) is False


async def test_school_has_icfes_false_without_an_entitlement(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        school = await _seed_school(session)

        assert await school_has_icfes(session, school_id=school.id) is False


async def test_active_entitlement_returns_none_for_a_cancelled_subscription(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        school = await _seed_school(session)
        session.add(
            Entitlement(
                school_id=school.id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status=SubscriptionStatus.CANCELLED,
            )
        )
        await session.commit()

        assert await active_entitlement(session, school_id=school.id) is None


# ---------------------------------------------------------------------------
# Counting
# ---------------------------------------------------------------------------


async def test_count_school_members_ignores_revoked_memberships(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        school = await _seed_school(session)

        for _ in range(3):
            user = await _seed_user(session)
            await _seed_membership(session, user=user, school=school, role=SchoolRole.STUDENT)

        revoked_user = await _seed_user(session)
        await _seed_membership(
            session,
            user=revoked_user,
            school=school,
            role=SchoolRole.STUDENT,
            revoked=True,
        )

        assert (
            await count_school_members(session, school_id=school.id, role=SchoolRole.STUDENT) == 3
        )
