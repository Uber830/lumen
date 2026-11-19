"""Subscriptions router.

Endpoints
---------

- POST /v1/subscriptions/checkout: returns a Wompi-hosted checkout URL
  the frontend can redirect to. The amount is computed from the
  plan_id in the request body; the merchant ID is the public_key
  configured in settings.

- POST /v1/subscriptions/portal: returns the Wompi customer portal URL
  for the school's existing subscription.

- GET /v1/subscriptions: returns the current subscription row (or
  null) for the school. Read-only.

The webhook handler (webhooks.py) is mounted separately and does not
require authentication.

Phase 2: the school is resolved from the request context, so it comes
from the caller's own membership and never from the request body.
"""

from __future__ import annotations

import logging
import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.db.enums import SchoolRole
from app.db.models import Entitlement, Plan, Subscription
from app.db.session import get_db
from app.deps import get_context
from app.wompi.client import WompiClient, WompiError

logger = logging.getLogger("lumen.subscriptions")

router = APIRouter(prefix="/v1/subscriptions", tags=["subscriptions"])


def _require_school_admin(context: RequestContext) -> uuid.UUID:
    """Resolve the school the caller is school_admin of."""
    membership = context.require_any_membership()
    if membership.role != SchoolRole.SCHOOL_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only school_admin can manage subscriptions.",
        )
    return membership.school_id


async def _get_plan(session: AsyncSession, plan_id: uuid.UUID) -> Plan:
    """Load an active plan by id."""
    result = await session.execute(select(Plan).where(Plan.id == plan_id))
    plan = result.scalar_one_or_none()
    if plan is None or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plan not found or not active.",
        )
    return plan


def _wompi_client_for_service() -> WompiClient:
    """Build a Wompi client for the privileged endpoint.

    The Settings are loaded from the env; this is a one-shot per
    request.
    """
    from app.config import get_settings

    return WompiClient(get_settings())


@router.post("/checkout")
async def checkout(
    body: dict[str, str],
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Create a hosted-checkout session for the given plan.

    Body: {"plan_id": "<uuid>"}
    Returns: {"checkout_url": "<wompi hosted checkout>", "reference": "<id>"}
    """
    plan_id = body.get("plan_id")
    if not plan_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="plan_id is required.",
        )

    try:
        parsed_plan_id = uuid.UUID(plan_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="plan_id must be a valid UUID.",
        ) from exc

    school_id = _require_school_admin(context)
    plan = await _get_plan(session, parsed_plan_id)

    reference = f"school-{school_id}-plan-{plan.code}"

    payload = {
        "name": f"Lumen {plan.name}",
        "description": f"Suscripcion {plan.name} para colegio {school_id}",
        "amount_in_cents": int(plan.price_cents),
        "currency": plan.currency,
        "reference": reference,
        "customer_email": context.email,
        "redirect_url": "http://localhost:8080/super/planes",
    }

    try:
        with _wompi_client_for_service() as wompi:
            response = wompi.create_transaction(payload)
    except WompiError as exc:
        logger.warning("Wompi create_transaction failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Wompi checkout failed: {exc.body}",
        ) from exc

    checkout_url = response.get("data", {}).get("checkout_url") or response.get(
        "checkout_url",
    )
    return {
        "checkout_url": checkout_url,
        "reference": reference,
        "wompi_transaction_id": response.get("data", {}).get("id"),
    }


@router.post("/portal")
async def portal(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Return the Wompi customer-portal URL for the school's subscription."""
    school_id = _require_school_admin(context)

    result = await session.execute(select(Subscription).where(Subscription.school_id == school_id))
    subscription = result.scalar_one_or_none()
    if subscription is None or not subscription.wompi_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription for this school.",
        )
    return {
        "wompi_subscription_id": subscription.wompi_subscription_id,
        "wompi_payment_source_id": subscription.wompi_payment_source_id,
    }


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
