"""Cross-tenant isolation.

Row Level Security used to be the only thing standing between one
school's data and another's. With the CRUD moving into the backend,
these tests are what stands in for it: a caller from one school must
not be able to read or write anything belonging to another.

The scenarios below all follow the same shape: two schools, a user in
each, and an attempt to cross the line.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import load_context
from app.core.errors import NotFoundError
from app.db.enums import SchoolRole, SubscriptionStatus
from app.db.models import (
    Entitlement,
    IcfesAttempt,
    IcfesQuestion,
    IcfesSimulation,
    Plan,
    School,
    SchoolMembership,
    User,
)

pytestmark = pytest.mark.usefixtures("cleanup_users")


async def _seed_school_with_admin(engine, role: SchoolRole) -> tuple[School, User]:
    """Create a school and a user with the given role in it."""
    school = School(
        id=uuid.uuid4(),
        name=f"Colegio {uuid.uuid4().hex[:8]}",
        short_code=f"X{uuid.uuid4().hex[:6].upper()}",
        status="active",
    )
    user = User(
        id=uuid.uuid4(),
        email=f"u-{uuid.uuid4().hex[:8]}@example.com",
        password_hash="",
        full_name="U",
    )
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add_all([school, user])
        await session.flush()
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=school.id,
                user_id=user.id,
                role=role,
                is_primary=True,
            )
        )
        session.add(
            Entitlement(
                school_id=school.id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status="active",
            )
        )
        await session.commit()
    return school, user


async def _seed_simulation(
    engine,
    school: School,
    poster: User,
) -> tuple[IcfesSimulation, IcfesQuestion]:
    """Create a published simulation with one question."""
    from app.db.models import Course, CourseSubject, Subject

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        course = Course(
            id=uuid.uuid4(),
            school_id=school.id,
            name="11mo A",
            grade_label="11",
        )
        subject = Subject(
            id=uuid.uuid4(),
            school_id=school.id,
            name="Matematicas",
        )
        session.add_all([course, subject])
        await session.flush()

        course_subject = CourseSubject(
            id=uuid.uuid4(),
            school_id=school.id,
            course_id=course.id,
            subject_id=subject.id,
        )
        question = IcfesQuestion(
            id=uuid.uuid4(),
            school_id=school.id,
            area="Matematicas",
            grado="11º",
            difficulty="Medio",
            prompt="Cuanto es 2+2?",
            options=["3", "4", "5", "6"],
        )
        session.add_all([course_subject, question])
        await session.flush()

        simulation = IcfesSimulation(
            id=uuid.uuid4(),
            school_id=school.id,
            course_subject_id=course_subject.id,
            posted_by=poster.id,
            title="Simulacro",
            is_published=True,
        )
        session.add(simulation)
        await session.commit()

    return simulation, question


# ---------------------------------------------------------------------------
# The context
# ---------------------------------------------------------------------------


async def test_a_caller_cannot_reach_another_school(engine):
    """The core property: the schools are separate."""
    school_a, user_a = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)
    school_b, _user_b = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        context = await load_context(session, user_id=user_a.id)

    # The caller belongs to school A only.
    assert len(context.memberships) == 1
    assert context.memberships[0].school_id == school_a.id
    assert school_b.id not in context.school_ids

    # Asking for school B is a 404, not a 403: a 403 would confirm
    # that the school exists.
    with pytest.raises(NotFoundError):
        context.require_membership(school_b.id)
    with pytest.raises(NotFoundError):
        context.require_role(school_b.id, SchoolRole.SCHOOL_ADMIN)


async def test_a_revoked_membership_stops_working_immediately(engine):
    """Revoking a membership takes effect on the next request."""
    school, user = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        context = await load_context(session, user_id=user.id)
        assert context.require_membership(school.id) is not None

        membership = await session.execute(
            select(SchoolMembership).where(
                SchoolMembership.user_id == user.id,
                SchoolMembership.school_id == school.id,
            )
        )
        row = membership.scalar_one()
        row.revoked_at = datetime.now(UTC)
        await session.commit()

        context = await load_context(session, user_id=user.id)

    assert context.memberships == ()
    with pytest.raises(NotFoundError):
        context.require_membership(school.id)


# ---------------------------------------------------------------------------
# The endpoints
# ---------------------------------------------------------------------------


async def test_the_comparisons_endpoint_does_not_leak_across_schools(client, engine):
    """A teacher in school A sees nothing from school B.

    The teacher path filters by the caller's assignments, and the
    school filter is applied first, so the two never mix.
    """
    school_a, user_a = await _seed_school_with_admin(engine, SchoolRole.TEACHER)
    school_b, user_b = await _seed_school_with_admin(engine, SchoolRole.TEACHER)

    simulation_a, _qa = await _seed_simulation(engine, school_a, user_a)
    simulation_b, _qb = await _seed_simulation(engine, school_b, user_b)

    from tests.conftest import mint_token

    token = mint_token(str(user_a.id), user_a.email or "")

    response = client.get(
        "/v1/icfes/comparisons",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    ids = {row["simulation_id"] for row in body["comparisons"]}
    assert str(simulation_a.id) not in ids
    assert str(simulation_b.id) not in ids


async def test_starting_an_attempt_on_another_schools_simulation_is_refused(client, engine):
    """A student cannot open an attempt on another school's simulation."""
    school_a, user_a = await _seed_school_with_admin(engine, SchoolRole.STUDENT)
    school_b, user_b = await _seed_school_with_admin(engine, SchoolRole.STUDENT)

    simulation_b, _q = await _seed_simulation(engine, school_b, user_b)

    from tests.conftest import mint_token

    token = mint_token(str(user_a.id), user_a.email or "")

    response = client.post(
        f"/v1/icfes/simulations/{simulation_b.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404, response.text


async def test_finalizing_another_students_attempt_is_refused(client, engine):
    """A student cannot grade someone else's attempt."""
    school_a, user_a = await _seed_school_with_admin(engine, SchoolRole.STUDENT)
    school_b, user_b = await _seed_school_with_admin(engine, SchoolRole.STUDENT)

    simulation_b, question_b = await _seed_simulation(engine, school_b, user_b)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        attempt = IcfesAttempt(
            id=uuid.uuid4(),
            school_id=school_b.id,
            simulation_id=simulation_b.id,
            student_id=user_b.id,
            status="in_progress",
        )
        session.add(attempt)
        await session.commit()
        attempt_id = attempt.id

    from tests.conftest import mint_token

    token = mint_token(str(user_a.id), user_a.email or "")

    response = client.post(
        f"/v1/icfes/attempts/{attempt_id}/finalize",
        headers={"Authorization": f"Bearer {token}"},
        json={"answers": [{"question_id": str(question_b.id), "chosen_index": 0}]},
    )
    # The attempt is in another school, so it is not even visible.
    assert response.status_code == 404, response.text


async def test_invitations_do_not_leak_across_schools(client, engine):
    """A school admin cannot invite into another school."""
    school_a, user_a = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)
    school_b, _user_b = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)

    from tests.conftest import mint_token

    token = mint_token(str(user_a.id), user_a.email or "")

    response = client.post(
        "/v1/users/invitations",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": f"invited-{uuid.uuid4().hex[:6]}@example.com",
            "full_name": "Invited",
            "role": "teacher",
            "school_id": str(school_b.id),
        },
    )
    assert response.status_code == 403, response.text


async def test_a_teacher_cannot_invite_users(client, engine):
    """Only a school admin can invite."""
    _school, user = await _seed_school_with_admin(engine, SchoolRole.TEACHER)

    from tests.conftest import mint_token

    token = mint_token(str(user.id), user.email or "")

    response = client.post(
        "/v1/users/invitations",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "email": f"invited-{uuid.uuid4().hex[:6]}@example.com",
            "full_name": "Invited",
            "role": "teacher",
        },
    )
    assert response.status_code == 403, response.text


async def test_the_entitlement_guard_blocks_a_school_without_icfes(client, engine):
    """A school whose plan excludes ICFES cannot open an attempt."""
    school, user = await _seed_school_with_admin(engine, SchoolRole.STUDENT)
    simulation, _question = await _seed_simulation(engine, school, user)

    # Downgrade the school to a plan without ICFES.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        entitlement = await session.execute(
            select(Entitlement).where(Entitlement.school_id == school.id)
        )
        row = entitlement.scalar_one()
        row.includes_icfes = False
        await session.commit()

    from tests.conftest import mint_token

    token = mint_token(str(user.id), user.email or "")

    response = client.post(
        f"/v1/icfes/simulations/{simulation.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403, response.text
    assert "entitlement" in response.json()["detail"].lower()


async def test_a_cancelled_subscription_blocks_icfes(client, engine):
    """The entitlement counts only while the subscription is active."""
    school, user = await _seed_school_with_admin(engine, SchoolRole.STUDENT)
    simulation, _question = await _seed_simulation(engine, school, user)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        entitlement = await session.execute(
            select(Entitlement).where(Entitlement.school_id == school.id)
        )
        row = entitlement.scalar_one()
        row.status = SubscriptionStatus.CANCELLED
        await session.commit()

    from tests.conftest import mint_token

    token = mint_token(str(user.id), user.email or "")

    response = client.post(
        f"/v1/icfes/simulations/{simulation.id}/attempts",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 403, response.text


async def test_a_user_with_no_membership_is_refused_everywhere(client, engine):
    """A user with no school cannot reach any school's data."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = User(
            id=uuid.uuid4(),
            email=f"lonely-{uuid.uuid4().hex[:8]}@example.com",
            password_hash="",
            full_name="Lonely",
        )
        session.add(user)
        await session.commit()
        user_id = user.id

    from tests.conftest import mint_token

    token = mint_token(str(user_id), "")

    memberships = client.get(
        "/v1/users/memberships",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert memberships.status_code == 200
    assert memberships.json() == []

    comparisons = client.get(
        "/v1/icfes/comparisons",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert comparisons.status_code == 403, comparisons.text


async def test_a_platform_admin_is_not_automatically_a_school_member(engine):
    """The global role does not leak into the school scope.

    A platform admin sees global metrics, not a school's academic
    data. Keeping the roles separate is what makes that promise a
    technical constraint rather than a UI convention.
    """
    school, user = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        from app.db.models import PlatformRole

        session.add(PlatformRole(user_id=user.id, role="platform_admin"))
        await session.commit()

        context = await load_context(session, user_id=user.id)

    # The caller is a platform admin and a school admin. The two
    # coexist without one overriding the other.
    assert context.is_platform_admin is True
    assert context.memberships[0].role == SchoolRole.SCHOOL_ADMIN
    assert context.require_membership(school.id) is not None


async def test_a_school_admin_cannot_see_another_schools_subscription(client, engine):
    """The subscription endpoint is scoped to the caller's school."""
    school_a, user_a = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)
    school_b, _user_b = await _seed_school_with_admin(engine, SchoolRole.SCHOOL_ADMIN)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        plan = Plan(
            id=uuid.uuid4(),
            code=f"p-{uuid.uuid4().hex[:8]}",
            name="Plan",
            price_cents=1000,
            currency="COP",
            interval="monthly",
            is_active=True,
        )
        session.add(plan)
        await session.flush()

        from app.db.models import Subscription

        session.add(
            Subscription(
                id=uuid.uuid4(),
                school_id=school_b.id,
                plan_id=plan.id,
                status="active",
                interval="monthly",
            )
        )
        await session.commit()

    from tests.conftest import mint_token

    token = mint_token(str(user_a.id), user_a.email or "")

    response = client.get(
        "/v1/subscriptions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200, response.text

    body = response.json()
    # The caller sees their own school's (empty) subscription, not
    # school B's.
    assert body["subscription"] is None
