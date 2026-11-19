"""SQLAlchemy declarative base and shared column helpers.

Every model in app/db/models/ inherits from Base. The helpers here
keep the column definitions consistent with the Postgres schema that
lives in Supabase: uuid primary keys with gen_random_uuid() defaults,
timestamptz timestamps, and JSONB for the columns that hold structured
data.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base for every Lumen model.

    The schema lives in Supabase's `public` schema. The models declare
    it explicitly rather than inheriting a default, because
    `__table_args__` holds the table constraints and cannot be
    inherited and overridden at the same time.
    """


# --- Reusable column types ------------------------------------------------


def uuid_pk() -> Mapped[uuid.UUID]:
    """A uuid primary key with a client-side default.

    The server default in Postgres remains authoritative for rows
    inserted outside the ORM (e.g. by SQL migrations or psql).
    """
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


def uuid_fk(
    target: str,
    *,
    ondelete: str = "CASCADE",
    nullable: bool = False,
    index: bool = False,
) -> Mapped[uuid.UUID]:
    """A uuid column referencing another table by string target.

    The target is given as a string ("public.schools.id") instead of
    a mapped class so that models can reference each other in any
    order without circular-import gymnastics.
    """
    return mapped_column(
        UUID(as_uuid=True),
        ForeignKey(target, ondelete=ondelete),
        nullable=nullable,
        index=index,
    )


def created_at() -> Mapped[datetime]:
    """A timestamptz column defaulting to now() on insert."""
    return mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


def updated_at() -> Mapped[datetime]:
    """A timestamptz column defaulting to now(), kept fresh by trigger.

    The Postgres `set_updated_at` trigger (installed by the migrations)
    refreshes this on every UPDATE, so the ORM never has to.
    """
    return mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )


def jsonb() -> Mapped[object]:
    """A JSONB column."""
    return mapped_column(JSONB, nullable=True)


__all__ = [
    "Base",
    "JSONB",
    "created_at",
    "jsonb",
    "updated_at",
    "uuid_fk",
    "uuid_pk",
]
