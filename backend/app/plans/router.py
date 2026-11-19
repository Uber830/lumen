"""Plans router: the subscription catalog.

The catalog is read-only for regular users. A platform admin mutates
it through the backend. This router exposes the read side, which is
what the landing page and the signup form need.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Plan
from app.db.session import get_db

router = APIRouter(prefix="/v1/plans", tags=["plans"])


class PlanOut(BaseModel):
    """A plan of the catalog.

    The frontend reads the plan list before signing in, so this
    endpoint is public.
    """

    id: uuid.UUID
    code: str
    name: str
    description: str | None
    price_cents: int
    currency: str
    interval: str
    max_students: int | None
    max_teachers: int | None
    max_storage_gb: int | None
    includes_icfes: bool


class PlanUpdate(BaseModel):
    """A partial update of a plan. Platform admin only."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    price_cents: int | None = Field(default=None, ge=0)
    max_students: int | None = Field(default=None, ge=0)
    max_teachers: int | None = Field(default=None, ge=0)
    max_storage_gb: int | None = Field(default=None, ge=0)
    includes_icfes: bool | None = None
    is_active: bool | None = None


@router.get("", response_model=list[PlanOut])
async def list_plans(
    session: Annotated[AsyncSession, Depends(get_db)],
    include_inactive: Annotated[bool, Query()] = False,
) -> list[PlanOut]:
    """List the subscription plans.

    This endpoint is public: the landing page shows the catalog before
    anyone signs in. Inactive plans are hidden unless the caller asks
    for them explicitly.
    """
    statement = select(Plan).order_by(Plan.price_cents.asc())
    if not include_inactive:
        statement = statement.where(Plan.is_active.is_(True))

    result = await session.execute(statement)
    return [PlanOut.model_validate(plan, from_attributes=True) for plan in result.scalars()]


__all__ = ["PlanOut", "PlanUpdate", "router"]
