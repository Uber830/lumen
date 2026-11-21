"""The provisioning flow: the platform team creates a school.

This is the replacement of the self-service signup. A school asks the
platform team for access; the team creates the school, its
administrator and the activation link the administrator uses to set
their password.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.operations import create_user, issue_activation_token
from app.db.models.identity import Plan
from app.schools.operations import BootstrapError, bootstrap_school


@dataclass(frozen=True, slots=True)
class ProvisionedSchool:
    """The ids of the school that was created and its administrator."""

    school_id: uuid.UUID
    admin_user_id: uuid.UUID
    admin_email: str
    activation_token: str
    activation_expires_at: datetime


async def default_plan_code(session: AsyncSession) -> str:
    """The plan a school gets when the team does not choose one.

    The plans are not managed yet: a new school starts with the
    cheapest active plan, and the one that comes first by code when
    two of them cost the same.
    """
    result = await session.execute(
        select(Plan.code)
        .where(Plan.is_active.is_(True))
        .order_by(Plan.price_cents, Plan.code)
        .limit(1)
    )
    code = result.scalar_one_or_none()
    if code is None:
        raise BootstrapError("P0002", "there is no active plan to assign")
    return code


async def provision_school(
    session: AsyncSession,
    *,
    school_name: str,
    short_code: str,
    plan_code: str | None,
    admin_email: str,
    admin_name: str,
    trial_days: int,
    city: str | None = None,
) -> ProvisionedSchool:
    """Create a school, its administrator and the activation link.

    The administrator's account is created pending: it has no password
    until the activation link is used. That way nobody has to carry a
    password over to the school, and the account cannot be used before
    its owner receives it.

    Raises ConflictError when the administrator's email is already
    registered, and BootstrapError when the school or the plan cannot
    be created.
    """
    admin = await create_user(
        session,
        email=admin_email,
        full_name=admin_name,
    )

    # The plan is optional: when the team does not pick one, the
    # school gets the default one.
    if not plan_code or not plan_code.strip():
        plan_code = await default_plan_code(session)

    result = await bootstrap_school(
        session,
        user_id=admin.id,
        school_name=school_name,
        short_code=short_code,
        plan_code=plan_code,
        trial_days=trial_days,
        city=city,
    )

    token, expires_at = await issue_activation_token(session, admin.id)

    return ProvisionedSchool(
        school_id=result.school_id,
        admin_user_id=admin.id,
        admin_email=admin.email,
        activation_token=token,
        activation_expires_at=expires_at,
    )


__all__ = [
    "ProvisionedSchool",
    "provision_school",
]
