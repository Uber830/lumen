"""The queries behind the school administrator's panel.

Everything here is scoped to one school: the caller cannot choose it.
The school comes from the session, through the membership of the
caller, and the queries carry that `school_id` so that a row of
another tenant is never read.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AcademicPeriod,
    Entitlement,
    Profile,
    School,
    User,
)


async def get_school(session: AsyncSession, school_id: uuid.UUID) -> School | None:
    """The school of the caller."""
    result = await session.execute(select(School).where(School.id == school_id))
    return result.scalar_one_or_none()


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """The account of the caller."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_profile(session: AsyncSession, user_id: uuid.UUID) -> Profile | None:
    """The personal data of the caller."""
    result = await session.execute(select(Profile).where(Profile.id == user_id))
    return result.scalar_one_or_none()


async def get_entitlement(session: AsyncSession, school_id: uuid.UUID) -> Entitlement | None:
    """The plan the school is on.

    The plan lives in the subscription, and the entitlements row is the
    cache the rest of the backend reads. The administrator only reads
    it: it is context, not something it manages.
    """
    result = await session.execute(select(Entitlement).where(Entitlement.school_id == school_id))
    return result.scalar_one_or_none()


async def get_current_period(session: AsyncSession, school_id: uuid.UUID) -> AcademicPeriod | None:
    """The period the school is in, if it has one open."""
    result = await session.execute(
        select(AcademicPeriod)
        .where(
            AcademicPeriod.school_id == school_id,
            AcademicPeriod.is_current.is_(True),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


__all__ = [
    "get_current_period",
    "get_entitlement",
    "get_profile",
    "get_school",
    "get_user",
]
