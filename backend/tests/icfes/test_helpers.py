"""Tests for the ICFES entitlement check and the school resolution.

Phase 2 moved both of them onto the request context: the school comes
from the caller's own membership, and the entitlement is read through
the permission layer.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import Membership, RequestContext, load_context
from app.core.errors import ForbiddenError, NotFoundError
from app.core.permissions import school_has_icfes
from app.db.enums import SchoolRole
from app.db.models import Entitlement, School, SchoolMembership, User
from app.icfes.router import _require_icfes_entitlement


async def _seed_school(engine, user_id: uuid.UUID) -> uuid.UUID:
    """Create a school and a student membership, committed."""
    school_id = uuid.uuid4()
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            School(
                id=school_id,
                name=f"Colegio {school_id.hex[:8]}",
                short_code=f"T{school_id.hex[:6].upper()}",
                status="active",
            )
        )
        session.add(
            User(
                id=user_id,
                email=f"{user_id.hex[:8]}@example.com",
                password_hash="",
                full_name="U",
            )
        )
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=school_id,
                user_id=user_id,
                role=SchoolRole.STUDENT,
                is_primary=True,
                joined_at=datetime.now(UTC),
            )
        )
        await session.commit()
    return school_id


async def test_require_icfes_entitlement_returns_403_when_absent(engine):
    user_id = uuid.uuid4()
    school_id = await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        with pytest.raises(HTTPException) as exc:
            await _require_icfes_entitlement(session, school_id)
    assert exc.value.status_code == 403
    assert "entitlement" in exc.value.detail.lower()


async def test_require_icfes_entitlement_returns_403_when_disabled(engine):
    user_id = uuid.uuid4()
    school_id = await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            Entitlement(
                school_id=school_id,
                plan_code="basico",
                plan_name="Basico",
                includes_icfes=False,
                status="trial",
            )
        )
        await session.commit()

        with pytest.raises(HTTPException) as exc:
            await _require_icfes_entitlement(session, school_id)
    assert exc.value.status_code == 403


async def test_require_icfes_entitlement_passes_when_active(engine):
    user_id = uuid.uuid4()
    school_id = await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            Entitlement(
                school_id=school_id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status="active",
            )
        )
        await session.commit()

        await _require_icfes_entitlement(session, school_id)  # no exception


async def test_school_has_icfes_ignores_a_cancelled_subscription(engine):
    """A cancelled subscription does not entitle the school to ICFES.

    This is the subtle part of the SQL helper: the entitlement counts
    only when the status is active or trial.
    """
    user_id = uuid.uuid4()
    school_id = await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            Entitlement(
                school_id=school_id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status="cancelled",
            )
        )
        await session.commit()

        assert await school_has_icfes(session, school_id=school_id) is False


async def test_school_has_icfes_accepts_a_trial_subscription(engine):
    user_id = uuid.uuid4()
    school_id = await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            Entitlement(
                school_id=school_id,
                plan_code="estandar",
                plan_name="Estandar",
                includes_icfes=True,
                status="trial",
            )
        )
        await session.commit()

        assert await school_has_icfes(session, school_id=school_id) is True


# ---------------------------------------------------------------------------
# The request context
# ---------------------------------------------------------------------------


async def test_load_context_returns_the_memberships(engine):
    user_id = uuid.uuid4()
    school_id = await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        context = await load_context(session, user_id=user_id)

    assert context.user_id == user_id
    assert len(context.memberships) == 1
    assert context.memberships[0].school_id == school_id
    assert context.memberships[0].role == SchoolRole.STUDENT
    assert context.primary_school_id == school_id
    assert context.platform_role is None
    assert context.is_platform_admin is False


async def test_load_context_ignores_a_revoked_membership(engine):
    """A revoked membership grants nothing."""
    user_id = uuid.uuid4()
    await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        membership = await session.execute(
            select(SchoolMembership).where(SchoolMembership.user_id == user_id)
        )
        row = membership.scalar_one()
        row.revoked_at = datetime.now(UTC)
        await session.commit()

        context = await load_context(session, user_id=user_id)

    assert context.memberships == ()
    assert context.primary_school_id is None


async def test_load_context_reads_the_platform_role(engine):
    from app.db.models import PlatformRole

    user_id = uuid.uuid4()
    await _seed_school(engine, user_id)

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(PlatformRole(user_id=user_id, role="platform_admin"))
        await session.commit()

        context = await load_context(session, user_id=user_id)

    assert context.platform_role == "platform_admin"
    assert context.is_platform_admin is True


def test_require_membership_refuses_a_school_the_caller_does_not_belong_to():
    """A caller cannot reach a school they are not a member of.

    The error is a 404, not a 403: a 403 would confirm that the
    school exists, so the endpoint could be used to probe for other
    tenants' ids.
    """
    context = RequestContext(user_id=uuid.uuid4(), email="a@example.com")

    with pytest.raises(NotFoundError):
        context.require_membership(uuid.uuid4())


def test_require_role_refuses_the_wrong_role():
    """A member of the school without the right role gets a 403.

    Unlike the "not a member" case, the caller knows the school
    exists, so there is nothing to hide.
    """
    school_id = uuid.uuid4()
    membership = Membership(
        id=uuid.uuid4(),
        school_id=school_id,
        role=SchoolRole.STUDENT,
        is_primary=True,
        joined_at=datetime.now(UTC),
    )
    context = RequestContext(
        user_id=uuid.uuid4(),
        email="a@example.com",
        memberships=(membership,),
        _by_school={school_id: membership},
    )

    with pytest.raises(ForbiddenError):
        context.require_role(school_id, SchoolRole.SCHOOL_ADMIN)

    # The right role passes.
    assert context.require_role(school_id, SchoolRole.STUDENT) is membership
