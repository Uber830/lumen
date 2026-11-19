"""Wompi webhook handler with HMAC verification and idempotency.

Wompi may retry events. Each delivery is keyed by event_id (the
Wompi 'event' field + 'timestamp' field). We insert into
wompi_events_processed; if the insert conflicts, the event is a
duplicate and we skip it.

The signature is HMAC-SHA256 over the concatenation of the values of
the fields listed in signature.properties, in order, using the
events.secret fetched from Wompi's /merchants/{public_key} endpoint.
The events.secret is cached per process.

Only transaction.updated is processed here. subscription.updated and
other event types are logged and recorded in the idempotency table so
they don't repeat.

Phase 0: the Supabase SDK is replaced by SQLAlchemy. The idempotency
insert now relies on a database-level ON CONFLICT DO NOTHING, which
is the same guarantee the PostgREST upsert gave us.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.enums import SubscriptionStatus
from app.db.models import (
    Entitlement,
    Plan,
    Subscription,
    WompiEventProcessed,
)
from app.db.session import get_db
from app.wompi.client import WompiClient, WompiError

logger = logging.getLogger("lumen.wompi.webhook")

router = APIRouter(prefix="/v1/webhooks", tags=["webhooks"])


# Cached events.secret, looked up the first time a signature is
# verified. Process-local: reloaded on every restart, so secret
# rotation takes effect without code changes.
_events_secret_cache: dict[str, str] = {}


def _get_events_secret() -> str:
    """Return the Wompi events.secret, fetching from /merchants if needed."""
    settings = get_settings()
    cache_key = settings.wompi_public_key or ""
    if cache_key in _events_secret_cache:
        return _events_secret_cache[cache_key]
    try:
        with WompiClient(settings) as wompi:
            merchant = wompi.get_merchant()
    except WompiError as exc:
        logger.warning("Failed to fetch Wompi merchant: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wompi merchant info unavailable.",
        ) from exc
    secret = merchant.get("data", {}).get("events_secret") or ""
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Wompi merchant has no events_secret.",
        )
    _events_secret_cache[cache_key] = secret
    return secret


def _verify_signature(
    properties: list[str],
    checksum: str,
    payload: dict[str, Any],
    secret: str,
) -> bool:
    """Verify the Wompi event checksum.

    Wompi documents the algorithm as follows:

    1. For each dotted path in `signature.properties`, resolve the
       value **inside the event's `data` object** (for example
       `transaction.id` -> `data["transaction"]["id"]`) and
       concatenate the values as text, in order.
    2. Concatenate the event's `timestamp`.
    3. Concatenate the merchant's events secret.
    4. SHA-256 the result and compare it with `signature.checksum`,
       case-insensitively.

    The properties list must be read from the event, never hardcoded:
    Wompi changes it over time and between event types.

    The comparison uses `hmac.compare_digest` so it does not leak
    timing information.
    """
    data = payload.get("data")
    if not isinstance(data, dict):
        return False

    parts: list[str] = []
    for path in properties:
        value: Any = data
        for segment in path.split("."):
            if not isinstance(value, dict) or segment not in value:
                value = ""
                break
            value = value[segment]
        if value is None:
            value = ""
        parts.append(str(value))

    timestamp = payload.get("timestamp", "")
    message = f"{''.join(parts)}{timestamp}{secret}".encode()

    expected = hashlib.sha256(message).hexdigest()
    return hmac.compare_digest(expected.lower(), checksum.lower())


def _event_id(event: dict[str, Any]) -> str:
    """Compute a stable event_id from the Wompi event payload."""
    event_name = event.get("event", "")
    timestamp = event.get("timestamp", "")
    return f"{event_name}:{timestamp}"


def _reference_to_school_id(reference: str | None) -> str | None:
    """Parse 'school-{id}-plan-{code}' back into the school_id."""
    if not reference:
        return None
    parts = reference.split("-")
    if len(parts) < 3 or parts[0] != "school":
        return None
    return parts[1]


async def _process_transaction_updated(
    session: AsyncSession,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Apply a transaction.updated event to the subscriptions and
    entitlements tables.
    """
    transaction = payload.get("data", {}).get("transaction", {})
    status_value = str(transaction.get("status", "")).lower()
    reference = transaction.get("reference")
    school_id = _reference_to_school_id(reference)
    if not school_id:
        logger.warning("transaction.updated with no parseable school_id: %s", reference)
        return {"status": "ignored", "reason": "no school_id"}

    plan_code = reference.split("-")[-1] if reference else None
    plan: Plan | None = None
    if plan_code:
        plan_result = await session.execute(select(Plan).where(Plan.code == plan_code))
        plan = plan_result.scalar_one_or_none()

    status_map = {
        "approved": SubscriptionStatus.ACTIVE,
        "declined": SubscriptionStatus.CANCELLED,
        "voided": SubscriptionStatus.CANCELLED,
        "error": SubscriptionStatus.EXPIRED,
    }
    sub_status = status_map.get(status_value, SubscriptionStatus.PENDING)

    if plan is None:
        # Fallback: keep the existing plan if the new one is unknown.
        existing_result = await session.execute(
            select(Subscription).where(Subscription.school_id == school_id)
        )
        existing = existing_result.scalar_one_or_none()
        if existing is None:
            logger.warning("transaction.updated with unknown plan: %s", reference)
            return {"status": "ignored", "reason": "no plan"}
        plan_result = await session.execute(select(Plan).where(Plan.id == existing.plan_id))
        plan = plan_result.scalar_one_or_none()

    if plan is None:
        logger.warning("transaction.updated with unknown plan: %s", reference)
        return {"status": "ignored", "reason": "no plan"}

    # Upsert the subscription row for the school.
    subscription_payload = {
        "school_id": school_id,
        "plan_id": plan.id,
        "status": sub_status,
        "interval": "monthly",
        "customer_email": transaction.get("customer_email"),
        "wompi_subscription_id": str(transaction.get("id")) if transaction.get("id") else None,
        "started_at": transaction.get("created_at"),
        "current_period_end": transaction.get("finalized_at"),
        "raw": transaction,
    }
    await session.execute(
        pg_insert(Subscription)
        .values(**subscription_payload)
        .on_conflict_do_update(
            index_elements=[Subscription.school_id],
            set_={
                "plan_id": subscription_payload["plan_id"],
                "status": subscription_payload["status"],
                "interval": subscription_payload["interval"],
                "customer_email": subscription_payload["customer_email"],
                "wompi_subscription_id": subscription_payload["wompi_subscription_id"],
                "started_at": subscription_payload["started_at"],
                "current_period_end": subscription_payload["current_period_end"],
                "raw": subscription_payload["raw"],
            },
        )
    )

    # Rebuild the entitlements snapshot from the plan.
    await session.execute(
        pg_insert(Entitlement)
        .values(
            school_id=school_id,
            plan_code=plan.code,
            plan_name=plan.name,
            max_students=plan.max_students,
            max_teachers=plan.max_teachers,
            max_storage_gb=plan.max_storage_gb,
            includes_icfes=plan.includes_icfes,
            status=sub_status,
            current_period_end=transaction.get("finalized_at"),
        )
        .on_conflict_do_update(
            index_elements=[Entitlement.school_id],
            set_={
                "plan_code": plan.code,
                "plan_name": plan.name,
                "max_students": plan.max_students,
                "max_teachers": plan.max_teachers,
                "max_storage_gb": plan.max_storage_gb,
                "includes_icfes": plan.includes_icfes,
                "status": sub_status,
                "current_period_end": transaction.get("finalized_at"),
            },
        )
    )

    return {"status": "applied", "school_id": school_id, "subscription_status": sub_status.value}


@router.post("/wompi")
async def wompi_webhook(
    request: Request,
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Process a Wompi webhook event.

    Steps:
    1. Parse the JSON body.
    2. Verify the HMAC signature.
    3. Insert into wompi_events_processed with ON CONFLICT DO NOTHING.
       If the row already existed, the event is a duplicate and we
       short-circuit with 200 OK so Wompi stops retrying.
    4. Dispatch to the relevant handler.
    """
    body = await request.json()
    signature = body.get("signature", {})
    properties = signature.get("properties", [])
    checksum = signature.get("checksum", "")
    if not properties or not checksum:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing signature.properties or signature.checksum.",
        )

    events_secret = _get_events_secret()
    if not _verify_signature(properties, checksum, body, events_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid signature.",
        )

    event_id = _event_id(body)

    # Record the event. ON CONFLICT DO NOTHING makes this the
    # idempotency gate: when the row already exists the insert reports
    # no new row and the event is a duplicate.
    result = await session.execute(
        pg_insert(WompiEventProcessed)
        .values(
            event_id=event_id,
            event_type=body.get("event", "unknown"),
            payload=body,
        )
        .on_conflict_do_nothing(index_elements=[WompiEventProcessed.event_id])
        .returning(WompiEventProcessed.event_id)
    )
    if result.scalar_one_or_none() is None:
        await session.rollback()
        logger.info("Duplicate Wompi event %s, skipping", event_id)
        return {"status": "duplicate", "event_id": event_id}

    event_name = body.get("event", "")
    if event_name == "transaction.updated":
        outcome = await _process_transaction_updated(session, body)
    else:
        logger.info("Ignoring Wompi event %s", event_name)
        outcome = {"status": "ignored", "reason": f"unhandled event: {event_name}"}

    await session.commit()
    return {"status": "ok", "event_id": event_id, "result": outcome}
