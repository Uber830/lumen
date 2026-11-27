"""User operations.

Business logic for the `users` module, expressed as plain functions
that take an `AsyncSession`. The router validates the request, calls
these, and returns the result; it never touches the session directly.

Phase 0 note: invitations used to create a user of the previous
identity provider via
`auth.admin.create_user`. Phase 1 replaces that with a row in
`public.users` plus a reset-password token, so that the identity of
no longer involved. This module already writes to `public.users`
directly, which makes it the natural home for that flow.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.db.enums import SchoolRole
from app.db.models import Profile, School, SchoolMembership, User


async def find_user_by_email(session: AsyncSession, email: str) -> User | None:
    """Return the user with this email, case-insensitively.

    Emails are stored lowercased by `normalize_email`, but the lookup
    normalizes too so that a legacy row with mixed case is still
    found.
    """
    normalized = email.strip().lower()
    result = await session.execute(select(User).where(func.lower(User.email) == normalized))
    return result.scalar_one_or_none()


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Return a user by id, or None."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_profile(session: AsyncSession, user_id: uuid.UUID) -> Profile | None:
    """Return the profile of a user, or None."""
    result = await session.execute(select(Profile).where(Profile.id == user_id))
    return result.scalar_one_or_none()


async def active_memberships(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> list[SchoolMembership]:
    """Return every non-revoked membership of a user.

    Ordered so that the primary membership comes first, which is what
    the frontend uses to pick the active school.
    """
    result = await session.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.revoked_at.is_(None),
        )
        .order_by(
            SchoolMembership.is_primary.desc(),
            SchoolMembership.joined_at.asc(),
        )
    )
    return list(result.scalars().all())


async def create_invited_user(
    session: AsyncSession,
    *,
    email: str,
    full_name: str,
    role: SchoolRole,
    school_id: uuid.UUID,
    is_primary: bool = True,
) -> tuple[User, SchoolMembership]:
    """Create a user, their profile and their school membership.

    The three rows are written atomically inside a SAVEPOINT, so a
    failure (e.g. a duplicate email hitting the unique constraint)
    rolls back just these three rows without aborting whatever
    transaction the caller is running. This is what lets the bulk
    upload keep the rest of its batch when one row conflicts.

    Raises ConflictError when the email is already registered. Rather
    than pre-checking with a SELECT (the caller already rejects known
    duplicates, and the unique constraint is authoritative anyway),
    this relies on the IntegrityError raised by the flush, which saves
    a round-trip on the common path.
    """
    normalized = email.strip().lower()

    user = User(
        id=uuid.uuid4(),
        email=normalized,
        # Invited users have no password yet. They set one through the
        # password-reset flow, which replaces this placeholder.
        password_hash="",
        full_name=full_name,
        email_verified=False,
    )

    try:
        # A nested SAVEPOINT scopes the three inserts. On an
        # IntegrityError SQLAlchemy rolls back to the savepoint on exit,
        # leaving the outer transaction usable for the next row.
        async with session.begin_nested():
            session.add(user)
            session.add(
                Profile(
                    id=user.id,
                    full_name=full_name,
                    locale="es-CO",
                )
            )
            membership = SchoolMembership(
                id=uuid.uuid4(),
                school_id=school_id,
                user_id=user.id,
                role=role,
                # An invited administrator joins as secundario: the
                # principal of the school is the one who promotes them.
                admin_role="secundario" if role == SchoolRole.SCHOOL_ADMIN else None,
                is_primary=is_primary,
                joined_at=datetime.now(UTC),
            )
            session.add(membership)
            await session.flush()
    except IntegrityError as exc:
        raise ConflictError("A user with that email already exists.") from exc

    return user, membership


async def get_membership(
    session: AsyncSession,
    *,
    membership_id: uuid.UUID,
    school_id: uuid.UUID,
) -> SchoolMembership | None:
    """Return one membership of a school, or None.

    The school is part of the lookup: a caller can only reach the
    memberships of the school they administer.
    """
    result = await session.execute(
        select(SchoolMembership).where(
            SchoolMembership.id == membership_id,
            SchoolMembership.school_id == school_id,
        )
    )
    return result.scalar_one_or_none()


async def set_membership_revoked(
    session: AsyncSession,
    *,
    membership_id: uuid.UUID,
    school_id: uuid.UUID,
    acting_user_id: uuid.UUID,
    revoked: bool,
) -> SchoolMembership:
    """Deactivate (revoke) or reactivate a membership.

    Deactivating sets ``revoked_at``; reactivating clears it. The
    membership must belong to the admin's own school (tenant scoping).

    Guards against two foot-guns:
    - an admin cannot deactivate their own membership;
    - the last active school_admin of a school cannot be deactivated,
      so a school is never left with no one who can manage it.

    Raises NotFoundError when the membership is not in this school,
    and ConflictError when a guard trips.
    """
    result = await session.execute(
        select(SchoolMembership).where(
            SchoolMembership.id == membership_id,
            SchoolMembership.school_id == school_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError("Membership not found.")

    if revoked:
        if membership.user_id == acting_user_id:
            raise ConflictError("You cannot deactivate your own membership.")
        if membership.role == SchoolRole.SCHOOL_ADMIN:
            # Count the other active admins; refuse to revoke the last one.
            others = await session.execute(
                select(func.count())
                .select_from(SchoolMembership)
                .where(
                    SchoolMembership.school_id == school_id,
                    SchoolMembership.role == SchoolRole.SCHOOL_ADMIN,
                    SchoolMembership.revoked_at.is_(None),
                    SchoolMembership.id != membership_id,
                )
            )
            if (others.scalar_one() or 0) == 0:
                raise ConflictError("You cannot deactivate the last administrator of the school.")
        membership.revoked_at = datetime.now(UTC)
    else:
        membership.revoked_at = None

    await session.flush()
    return membership


async def school_exists(session: AsyncSession, school_id: uuid.UUID) -> bool:
    """Return True when the school row exists."""
    result = await session.execute(select(School.id).where(School.id == school_id))
    return result.scalar_one_or_none() is not None


async def require_user(session: AsyncSession, user_id: uuid.UUID) -> User:
    """Return the user or raise NotFoundError."""
    user = await get_user(session, user_id)
    if user is None:
        raise NotFoundError("User not found.")
    return user


__all__ = [
    "active_memberships",
    "create_invited_user",
    "find_user_by_email",
    "get_profile",
    "get_user",
    "require_user",
    "school_exists",
    "set_membership_revoked",
]
