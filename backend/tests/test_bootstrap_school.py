"""Tests for the bootstrap_school port.

The SQL function this replaces had a specific contract, and the
frontend's signup flow depends on it:

- It creates the school, the admin membership, the trial
  subscription and the entitlements cache.
- It is idempotent.
- Its business errors keep their SQLSTATE codes, so the frontend can
  translate them.
"""

from __future__ import annotations

import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import SubscriptionStatus
from app.db.models import (
    Entitlement,
    Plan,
    Profile,
    School,
    SchoolMembership,
    Subscription,
    User,
)
from app.schools.operations import BootstrapError, bootstrap_school

pytestmark = pytest.mark.usefixtures("cleanup_users")


def _unique_code(prefix: str) -> str:
    """A short code unique to this test run.

    The schools are committed, so a fixed code would collide with the
    rows a previous run left behind.
    """
    return f"T{prefix}{uuid.uuid4().hex[:6].upper()}"


async def _seed_user(session: AsyncSession) -> User:
    """Create a user to own the school."""
    user = User(
        id=uuid.uuid4(),
        email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
        password_hash="",
        full_name="Admin",
    )
    session.add(user)
    session.add(Profile(id=user.id, full_name="Admin"))
    await session.commit()
    return user


async def _seed_plans(session: AsyncSession) -> None:
    """Seed the plan catalog the way the SQL migration does.

    The catalog is reference data that the schema migration already
    provides, so the insert is a no-op when the plans are there.
    """
    existing = await session.execute(select(Plan.code))
    present = set(existing.scalars().all())

    catalog = [
        Plan(
            code="basico",
            name="Basico",
            price_cents=49000,
            currency="COP",
            interval="monthly",
            max_students=200,
            max_teachers=15,
            max_storage_gb=10,
            includes_icfes=False,
            is_active=True,
        ),
        Plan(
            code="estandar",
            name="Estandar",
            price_cents=129000,
            currency="COP",
            interval="monthly",
            max_students=1500,
            max_teachers=None,
            max_storage_gb=100,
            includes_icfes=True,
            is_active=True,
        ),
    ]
    session.add_all([plan for plan in catalog if plan.code not in present])
    await session.commit()


# ---------------------------------------------------------------------------
# The happy path
# ---------------------------------------------------------------------------


async def test_bootstrap_creates_the_school_and_its_dependants(engine):
    """One call creates the school, the membership, the subscription and
    the entitlements."""
    short_code = _unique_code("CSM")
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        await _seed_plans(session)

        result = await bootstrap_school(
            session,
            user_id=user.id,
            school_name="Colegio San Martin",
            short_code=short_code,
            plan_code="estandar",
        )
        await session.commit()

        assert result.already_existed is False
        assert result.school_id is not None
        assert result.membership_id is not None
        assert result.subscription_id is not None

        # The school, with the short code uppercased.
        school = await session.execute(select(School).where(School.id == result.school_id))
        row = school.scalar_one()
        assert row.name == "Colegio San Martin"
        assert row.short_code == short_code.upper()
        assert row.status == "trial"

        # The admin membership, primary.
        membership = await session.execute(
            select(SchoolMembership).where(SchoolMembership.id == result.membership_id)
        )
        member = membership.scalar_one()
        assert member.user_id == user.id
        assert member.school_id == result.school_id
        assert member.role == "school_admin"
        assert member.is_primary is True

        # The trial subscription.
        subscription = await session.execute(
            select(Subscription).where(Subscription.id == result.subscription_id)
        )
        sub = subscription.scalar_one()
        assert sub.school_id == result.school_id
        assert sub.status == SubscriptionStatus.TRIAL
        assert sub.interval == "monthly"
        assert sub.current_period_end is not None

        # The entitlements cache, with the plan's limits.
        entitlement = await session.execute(
            select(Entitlement).where(Entitlement.school_id == result.school_id)
        )
        ent = entitlement.scalar_one()
        assert ent.plan_code == "estandar"
        assert ent.plan_name == "Estandar"
        assert ent.max_students == 1500
        assert ent.max_teachers is None
        assert ent.includes_icfes is True
        assert ent.subscription_id == result.subscription_id
        assert ent.status == SubscriptionStatus.TRIAL


async def test_the_trial_ends_after_the_requested_days(engine):
    """The trial period is honoured."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        await _seed_plans(session)

        result = await bootstrap_school(
            session,
            user_id=user.id,
            school_name="Trial School",
            short_code=_unique_code("TRIAL"),
            plan_code="basico",
            trial_days=7,
        )
        await session.commit()

        subscription = await session.execute(
            select(Subscription).where(Subscription.id == result.subscription_id)
        )
        sub = subscription.scalar_one()

        assert sub.current_period_end is not None
        assert sub.current_period_start is not None
        delta = sub.current_period_end - sub.current_period_start
        assert 6 <= delta.days <= 7


async def test_bootstrap_is_idempotent(engine):
    """A second call returns the school from the first one."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        await _seed_plans(session)

        first_code = _unique_code("IDEM")
        first = await bootstrap_school(
            session,
            user_id=user.id,
            school_name="Idempotent School",
            short_code=first_code,
            plan_code="basico",
        )
        await session.commit()

        second = await bootstrap_school(
            session,
            user_id=user.id,
            school_name="A Different Name",
            short_code=_unique_code("OTHER"),
            plan_code="estandar",
        )
        await session.commit()

        assert second.already_existed is True
        assert second.school_id == first.school_id

        # Only one school was created.
        schools = await session.execute(
            select(School).where(School.short_code == first_code.upper())
        )
        assert len(schools.scalars().all()) == 1


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


async def test_bootstrap_rejects_an_unknown_plan(engine):
    """An unknown plan code keeps the P0002 code the frontend expects."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)

        with pytest.raises(BootstrapError) as exc:
            await bootstrap_school(
                session,
                user_id=user.id,
                school_name="No Plan School",
                short_code="noplan",
                plan_code="does-not-exist",
            )
        assert exc.value.code == "P0002"


async def test_bootstrap_rejects_an_inactive_plan(engine):
    """An inactive plan is treated like a missing one."""
    from sqlalchemy import update

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)

        # The plan may already be there from a previous run, so it is
        # upserted rather than inserted.
        existing = await session.execute(select(Plan).where(Plan.code == "retired"))
        if existing.scalar_one_or_none() is None:
            session.add(
                Plan(
                    code="retired",
                    name="Retired",
                    price_cents=1000,
                    currency="COP",
                    interval="monthly",
                    is_active=False,
                )
            )
        else:
            await session.execute(
                update(Plan).where(Plan.code == "retired").values(is_active=False)
            )
        await session.commit()

        with pytest.raises(BootstrapError) as exc:
            await bootstrap_school(
                session,
                user_id=user.id,
                school_name="Retired Plan School",
                short_code=_unique_code("RET"),
                plan_code="retired",
            )
        assert exc.value.code == "P0002"


async def test_bootstrap_rejects_a_duplicate_short_code(engine):
    """A taken short code keeps the 23505 code the frontend expects."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        first_user = await _seed_user(session)
        await _seed_plans(session)

        shared_code = _unique_code("DUP")
        await bootstrap_school(
            session,
            user_id=first_user.id,
            school_name="First School",
            short_code=shared_code,
            plan_code="basico",
        )
        await session.commit()

        second_user = await _seed_user(session)
        with pytest.raises(BootstrapError) as exc:
            await bootstrap_school(
                session,
                user_id=second_user.id,
                school_name="Second School",
                short_code=shared_code,
                plan_code="basico",
            )
        assert exc.value.code == "23505"


async def test_bootstrap_rejects_a_duplicate_name(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        first_user = await _seed_user(session)
        await _seed_plans(session)

        shared_name = f"Same Name {uuid.uuid4().hex[:8]}"
        await bootstrap_school(
            session,
            user_id=first_user.id,
            school_name=shared_name,
            short_code=_unique_code("ONE"),
            plan_code="basico",
        )
        await session.commit()

        second_user = await _seed_user(session)
        with pytest.raises(BootstrapError) as exc:
            await bootstrap_school(
                session,
                user_id=second_user.id,
                school_name=shared_name,
                short_code=_unique_code("TWO"),
                plan_code="basico",
            )
        assert exc.value.code == "23505"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("school_name", "   "),
        ("short_code", ""),
        ("plan_code", "  "),
    ],
)
async def test_bootstrap_rejects_blank_inputs(engine, field, value):
    """A blank input keeps the 22023 code."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)

        kwargs: dict[str, object] = {
            "user_id": user.id,
            "school_name": "Valid Name",
            "short_code": "valid",
            "plan_code": "basico",
        }
        kwargs[field] = value

        with pytest.raises(BootstrapError) as exc:
            await bootstrap_school(
                session,
                user_id=kwargs["user_id"],  # type: ignore[arg-type]
                school_name=kwargs["school_name"],  # type: ignore[arg-type]
                short_code=kwargs["short_code"],  # type: ignore[arg-type]
                plan_code=kwargs["plan_code"],  # type: ignore[arg-type]
            )
        assert exc.value.code == "22023"


@pytest.mark.parametrize("trial_days", [0, -1, 366])
async def test_bootstrap_rejects_an_out_of_range_trial(engine, trial_days):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await _seed_user(session)
        await _seed_plans(session)

        with pytest.raises(BootstrapError) as exc:
            await bootstrap_school(
                session,
                user_id=user.id,
                school_name="Trial Range School",
                short_code=_unique_code("RANGE"),
                plan_code="basico",
                trial_days=trial_days,
            )
        assert exc.value.code == "22023"
