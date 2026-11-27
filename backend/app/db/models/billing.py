"""Billing models.

- `subscriptions` — a school bound to a plan over a period.
- `entitlements`  — a denormalized cache of the active plan's limits,
                    so the ICFES guard and the permission checks can
                    read them cheaply.

The app does not sell anything: the platform team sets the plan when
the school is registered, and `entitlements` is written from there.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, jsonb, updated_at
from app.db.enums import BillingInterval, SubscriptionStatus, pg_enum


class Subscription(Base):
    """A school bound to a plan over a period.

    One row per school (unique on school_id): the current subscription.
    """

    __tablename__ = "subscriptions"
    __table_args__ = (
        # One subscription per school: the current one.
        UniqueConstraint("school_id", name="subscriptions_school_uq"),
        {"schema": "public"},
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
    )
    plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.plans.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        pg_enum(SubscriptionStatus, "subscription_status"),
        nullable=False,
        default=SubscriptionStatus.PENDING,
        server_default=text("'pending'"),
    )
    interval: Mapped[BillingInterval] = mapped_column(
        pg_enum(BillingInterval, "billing_interval"),
        nullable=False,
    )
    customer_email: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    cancelled_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    raw: Mapped[object | None] = jsonb()
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class Entitlement(Base):
    """A denormalized snapshot of the active plan's limits.

    The primary key is the school id: one row per school. `status`
    mirrors the subscription status so the ICFES guard can reason
    about the plan without joining `plans` and `subscriptions`.
    """

    __tablename__ = "entitlements"
    __table_args__ = ({"schema": "public"},)
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        primary_key=True,
    )
    plan_code: Mapped[str] = mapped_column(Text, nullable=False)
    plan_name: Mapped[str] = mapped_column(Text, nullable=False)
    max_students: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_teachers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_storage_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    includes_icfes: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    # Subscription identity for traceability / debugging.
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.subscriptions.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        pg_enum(SubscriptionStatus, "subscription_status"),
        nullable=False,
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    updated_at: Mapped[datetime] = updated_at()


__all__ = [
    "Entitlement",
    "Subscription",
]
