"""Subscriptions router.

Endpoint
--------

- GET /v1/subscriptions: returns the current subscription row (or
  null) for the school, plus the entitlement that says what the school
  has enabled. Read-only.

The app does not sell anything: the plan and the entitlement are set
by the platform team when the school is registered. There is no
checkout and there is no payment provider in the middle.

The school is resolved from the request context, so it comes from the
caller's own membership and never from the request body.
"""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.db.models import Entitlement, Subscription
from app.db.session import get_db
from app.deps import get_context

router = APIRouter(prefix="/v1/subscriptions", tags=["subscriptions"])


@router.get("")
async def get_current_subscription(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Return the current subscription for the caller's school, plus the
    cached entitlements. Returns null if none exists."""
    membership = context.require_any_membership()
    school_id = membership.school_id

    subscription_result = await session.execute(
        select(Subscription).where(Subscription.school_id == school_id)
    )
    subscription = subscription_result.scalar_one_or_none()

    entitlement_result = await session.execute(
        select(Entitlement).where(Entitlement.school_id == school_id)
    )
    entitlement = entitlement_result.scalar_one_or_none()

    return {
        "subscription": _serialize(subscription),
        "entitlements": _serialize(entitlement),
    }


def _serialize(row: Any) -> dict[str, Any] | None:
    """Turn an ORM row into a plain dict, or None."""
    if row is None:
        return None
    return {column.name: getattr(row, column.name) for column in row.__table__.columns}
