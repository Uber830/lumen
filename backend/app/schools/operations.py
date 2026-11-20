"""School bootstrap: the operation that creates a school.

This is the Python port of the `bootstrap_school` SQL function that
lived in `supabase/migrations/20260813050000_bootstrap_school_rpc.sql`.
The RPC existed because the user who signed up could not insert into
`public.schools` directly: the RLS policy required `is_platform_admin`.
With the logic in Python there is no such obstacle, so the function
became a plain operation.

Who calls it is the platform team, from `app.platform`: the schools
are onboarded by the people who run the platform, not by the users.

The behaviour is preserved exactly:

- It creates the school, the admin membership, the trial subscription
  and the entitlements cache.
- It is idempotent: when the caller already has a primary membership,
  it returns that school instead of creating a duplicate.
- The business errors keep their SQLSTATE meaning, so the frontend
  can translate them the same way:
  - `23505` -> the short code or the name is already taken.
  - `P0002` -> the plan does not exist or is not active.
  - `22023` -> a required input is missing.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import cast

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.enums import BillingInterval, SubscriptionStatus
from app.db.models import (
    Entitlement,
    Plan,
    School,
    SchoolMembership,
    Subscription,
)

# The default trial length offered at signup.
DEFAULT_TRIAL_DAYS = 30


class BootstrapError(Exception):
    """A business error in the bootstrap flow.

    `code` mirrors the SQLSTATE the SQL function used to raise, so the
    frontend keeps its existing translation table.
    """

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True, slots=True)
class BootstrapResult:
    """The ids created by the bootstrap, or the ones that already existed."""

    school_id: uuid.UUID
    membership_id: uuid.UUID | None
    subscription_id: uuid.UUID | None
    entitlement_id: uuid.UUID | None
    already_existed: bool


async def bootstrap_school(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_name: str,
    short_code: str,
    plan_code: str,
    trial_days: int = DEFAULT_TRIAL_DAYS,
    city: str | None = None,
) -> BootstrapResult:
    """Create a school for a user, with its trial subscription.

    Idempotent: if the caller already has a primary membership, the
    existing school is returned and nothing is created.
    """
    # --- Validate the inputs -------------------------------------------
    if not school_name or not school_name.strip():
        raise BootstrapError("22023", "school_name is required")
    if not short_code or not short_code.strip():
        raise BootstrapError("22023", "short_code is required")
    if not plan_code or not plan_code.strip():
        raise BootstrapError("22023", "plan_code is required")
    if trial_days < 1 or trial_days > 365:
        raise BootstrapError("22023", "trial_days must be between 1 and 365")

    normalized_name = school_name.strip()
    normalized_code = short_code.strip().upper()

    # --- Idempotency ---------------------------------------------------
    existing_result = await session.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.is_primary.is_(True),
            SchoolMembership.revoked_at.is_(None),
        )
        .limit(1)
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        return BootstrapResult(
            school_id=existing.school_id,
            membership_id=existing.id,
            subscription_id=None,
            entitlement_id=None,
            already_existed=True,
        )

    # --- Resolve the plan -----------------------------------------------
    plan_result = await session.execute(
        select(Plan).where(Plan.code == plan_code.strip(), Plan.is_active.is_(True))
    )
    plan = plan_result.scalar_one_or_none()
    if plan is None:
        raise BootstrapError("P0002", f"plan {plan_code} not found or inactive")

    now = datetime.now(UTC)
    period_end = now + timedelta(days=trial_days)

    try:
        # --- Create the school ------------------------------------------
        school = School(
            id=uuid.uuid4(),
            name=normalized_name,
            short_code=normalized_code,
            city=city.strip() if city and city.strip() else None,
            status="trial",
        )
        session.add(school)
        # Flush the school before the rows that reference it. The models
        # carry plain foreign keys rather than ORM relationships, so
        # SQLAlchemy cannot infer the insert order on its own.
        await session.flush()

        # The admin membership. is_primary = true so the session picks
        # this school as primary.
        membership = SchoolMembership(
            id=uuid.uuid4(),
            school_id=school.id,
            user_id=user_id,
            role="school_admin",
            is_primary=True,
            joined_at=now,
        )
        session.add(membership)

        # Trial subscription. The Wompi webhook rewrites this when a
        # paid plan is activated.
        subscription = Subscription(
            id=uuid.uuid4(),
            school_id=school.id,
            plan_id=plan.id,
            status=SubscriptionStatus.TRIAL,
            interval=BillingInterval.MONTHLY,
            started_at=now,
            current_period_start=now,
            current_period_end=period_end,
        )
        session.add(subscription)
        # The entitlement references the subscription, so it has to
        # exist before the next insert.
        await session.flush()

        # Entitlements cache. This is the row the ICFES guard and the
        # permission checks read.
        entitlement = Entitlement(
            school_id=school.id,
            plan_code=plan.code,
            plan_name=plan.name,
            max_students=plan.max_students,
            max_teachers=plan.max_teachers,
            max_storage_gb=plan.max_storage_gb,
            includes_icfes=plan.includes_icfes,
            subscription_id=subscription.id,
            status=SubscriptionStatus.TRIAL,
            current_period_end=period_end,
        )
        session.add(entitlement)

        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        # The unique constraints on schools.name and schools.short_code
        # are what rejected the insert.
        raise BootstrapError(
            "23505",
            "Ese colegio ya existe con ese nombre o codigo corto.",
        ) from exc

    return BootstrapResult(
        school_id=school.id,
        membership_id=membership.id,
        subscription_id=subscription.id,
        entitlement_id=entitlement.school_id,
        already_existed=False,
    )


# ---------------------------------------------------------------------------
# School profile (read / branding update)
# ---------------------------------------------------------------------------


async def get_school(session: AsyncSession, school_id: uuid.UUID) -> School:
    """Return a school by id, or raise NotFoundError."""
    from app.core.errors import NotFoundError

    result = await session.execute(select(School).where(School.id == school_id))
    school = result.scalar_one_or_none()
    if school is None:
        raise NotFoundError("School not found.")
    return school


async def update_school(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> School:
    """Apply a partial update to a school's branding.

    ``changes`` is the set of fields actually sent
    (``model_dump(exclude_unset=True)``), so an omitted field is left
    untouched and an explicit null clears it. Only branding fields are
    writable here: display_name, logo_url, primary_color, mission,
    vision, banner_url and gallery.

    display_name is normalised (trimmed, empty -> null). The name and
    short_code are not editable through this path: they are the unique
    identity set at signup.
    """
    school = await get_school(session, school_id)

    for field in ("display_name", "logo_url", "primary_color", "mission", "vision", "banner_url"):
        if field in changes:
            value = changes[field]
            if isinstance(value, str):
                value = value.strip() or None
            setattr(school, field, value)

    if "gallery" in changes:
        raw_gallery = changes["gallery"]
        # The gallery is a list of {"url": ..., "caption": ...}; the
        # request model already validated its shape.
        gallery = cast(list[dict[str, object]], raw_gallery) if raw_gallery else []
        school.gallery = gallery

    await session.flush()
    return school


__all__ = [
    "DEFAULT_TRIAL_DAYS",
    "BootstrapError",
    "BootstrapResult",
    "bootstrap_school",
    "get_school",
    "update_school",
]
