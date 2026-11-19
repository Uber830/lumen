"""Identity and tenant models.

This module covers the platform side of the schema:

- `users`          — the identity table. Phase 1 replaces Supabase
                     Auth, so `auth.users` is no longer the source of
                     truth; `public.users` takes its place.
- `profiles`       — domain profile data, 1:1 with a user.
- `platform_roles` — global roles (platform_admin) outside schools.
- `schools`        — the tenant entity.
- `school_memberships` — joins a user to a school with a role.
- `plans`          — the subscription catalog.

The FK targets below use string references ("public.users.id") so the
models can reference each other in any order without circular
imports.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at, updated_at
from app.db.enums import (
    PlanInterval,
    PlatformRoleKind,
    SchoolAdminRole,
    SchoolRole,
    SchoolStatus,
    pg_enum,
)


class User(Base):
    """An authenticated identity.

    Phase 1 replaces Supabase Auth: this table is the new home of the
    identity data that used to live in `auth.users`. The UUIDs are
    preserved when migrating existing rows so that the foreign keys on
    `profiles`, `school_memberships`, `teacher_assignments`, etc. keep
    pointing at the same identities.
    """

    __tablename__ = "users"
    __table_args__ = ({"schema": "public"},)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    # Argon2id hash produced by app.core.security.hash_password.
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    full_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    # While set, the account is locked and signing in answers 423. A
    # null value means the account is not locked.
    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # When the account was used for the last time.
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    profile: Mapped[Profile | None] = relationship(
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    memberships: Mapped[list[SchoolMembership]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        # The membership has two foreign keys to the user: the one that
        # says who it belongs to and the one that says who invited it.
        # The relationship is the first one.
        foreign_keys="SchoolMembership.user_id",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<User {self.email}>"


class Profile(Base):
    """Domain profile data. 1:1 with a user.

    Never stores sensitive auth data: no password hashes, no tokens.
    """

    __tablename__ = "profiles"
    __table_args__ = ({"schema": "public"},)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    given_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    family_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    locale: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="es-CO",
        server_default=text("'es-CO'"),
    )
    # Public URL of the user avatar in the storage.avatars bucket.
    avatar_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    user: Mapped[User] = relationship(back_populates="profile")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Profile {self.full_name}>"


class PlatformRole(Base):
    """Global roles that are not tied to a particular school.

    Only `platform_admin` exists for now. Keeping it outside
    `school_memberships` lets the platform grant or revoke global
    privileges without touching a school's membership rows.
    """

    __tablename__ = "platform_roles"
    __table_args__ = ({"schema": "public"},)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    role: Mapped[PlatformRoleKind] = mapped_column(
        pg_enum(PlatformRoleKind, "platform_role_kind"),
        nullable=False,
    )
    granted_at: Mapped[datetime] = created_at()
    granted_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )


class School(Base):
    """The tenant entity.

    Every academic table in Lumen carries a `school_id` foreign key
    pointing here.
    """

    __tablename__ = "schools"
    __table_args__ = (
        UniqueConstraint("name", name="schools_name_uq"),
        UniqueConstraint("short_code", name="schools_short_code_uq"),
        {"schema": "public"},
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    short_code: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[SchoolStatus] = mapped_column(
        pg_enum(SchoolStatus, "school_status"),
        nullable=False,
        default=SchoolStatus.ACTIVE,
        server_default=text("'active'"),
    )
    # --- Branding (the "Personalización" view) -------------------------
    # A friendly name shown in the UI; falls back to `name` when null.
    display_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Public URL of the logo in the school-logos bucket.
    logo_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Brand primary colour as an oklch() string, applied to the theme.
    primary_color: Mapped[str | None] = mapped_column(Text, nullable=True)
    # --- Institutional identity (the dashboard hero) --------------------
    # What the school says about itself, in its own words.
    mission: Mapped[str | None] = mapped_column(Text, nullable=True)
    vision: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Public URL of the cover image (the dashboard hero).
    banner_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # The pictures the school chose to show: a list of
    # {"url": ..., "caption": ...}. It is a column and not a table
    # because the list is short and always read with the school.
    gallery: Mapped[list[dict[str, object]]] = mapped_column(
        JSONB,
        nullable=False,
        default=list,
        server_default=text("'[]'::jsonb"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<School {self.short_code}>"


class SchoolMembership(Base):
    """Joins a user to a school with a specific role.

    Unique per (school, user, role). `revoked_at` marks a revoked
    membership without deleting the history.

    At most one primary membership per (school, user) is enforced by
    a partial unique index in the migration.
    """

    __tablename__ = "school_memberships"
    __table_args__ = (
        UniqueConstraint(
            "school_id",
            "user_id",
            "role",
            name="school_memberships_school_user_role_uq",
        ),
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
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[SchoolRole] = mapped_column(
        pg_enum(SchoolRole, "school_role"),
        nullable=False,
    )
    # The rank of an administrator: principal or secundario. It is
    # null for teachers and students.
    admin_role: Mapped[SchoolAdminRole | None] = mapped_column(
        pg_enum(SchoolAdminRole, "school_admin_role"),
        nullable=True,
    )
    # The administrator who invited this one, and when.
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    invited_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    joined_at: Mapped[datetime] = created_at()
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # The activation link is not stored here: it is rotated every time
    # the admin asks for it, and only its hash lives in
    # password_reset_tokens.
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    user: Mapped[User] = relationship(
        back_populates="memberships",
        foreign_keys="SchoolMembership.user_id",
    )
    # The administrator who invited this one, when there was one.
    inviter: Mapped[User | None] = relationship(
        foreign_keys="SchoolMembership.invited_by",
    )
    school: Mapped[School] = relationship()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SchoolMembership {self.role} school={self.school_id}>"


class SchoolSettings(Base):
    """The preferences of a school: notifications and enrolment.

    One row per school. The identity of the school lives in `schools`;
    what the school wants to be told about lives here, so that the two
    concerns do not get mixed.
    """

    __tablename__ = "school_settings"
    __table_args__ = ({"schema": "public"},)

    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        primary_key=True,
    )
    notify_new_material: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    notify_period_reminders: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    notify_channel: Mapped[str] = mapped_column(
        String(8),
        nullable=False,
        default="inapp",
        server_default=text("'inapp'"),
    )
    enrollment_open: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    enrollment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SchoolSettings school={self.school_id}>"


class Plan(Base):
    """Catalog of subscription plans.

    Read-only for regular users; mutated by platform_admin through the
    backend. The limit columns are the source of truth for the
    entitlements contract.
    """

    __tablename__ = "plans"
    __table_args__ = (
        UniqueConstraint("code", name="plans_code_uq"),
        {"schema": "public"},
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    code: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    price_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(
        String(8),
        nullable=False,
        default="COP",
        server_default=text("'COP'"),
    )
    interval: Mapped[PlanInterval] = mapped_column(
        pg_enum(PlanInterval, "plan_interval"),
        nullable=False,
        default=PlanInterval.MONTHLY,
        server_default=text("'monthly'"),
    )
    max_students: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_teachers: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_storage_gb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    includes_icfes: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Plan {self.code}>"


__all__ = [
    "Plan",
    "PlatformRole",
    "Profile",
    "School",
    "SchoolMembership",
    "SchoolSettings",
    "User",
]
