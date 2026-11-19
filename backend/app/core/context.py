"""The request context: who is calling, and what they may do.

`RequestContext` is loaded once per request and carries everything
the permission checks need:

- the user id and email, from the verified token;
- the active school memberships, with their roles;
- the platform role, if the user has one.

Loading it once matters for two reasons. It avoids a database round
trip per permission check, and it makes the checks cheap to reason
about: the context is a snapshot, taken at the start of the request.

The context never trusts the request body. The `school_id` a caller
sends is only ever used to *look up* a membership; the membership
itself is what grants access.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ForbiddenError, NotFoundError
from app.db.enums import SchoolRole
from app.db.models import PlatformRole, SchoolMembership


@dataclass(frozen=True, slots=True)
class Membership:
    """One of the schools the caller belongs to."""

    id: uuid.UUID
    school_id: uuid.UUID
    role: SchoolRole
    is_primary: bool
    joined_at: datetime


@dataclass(frozen=True, slots=True)
class RequestContext:
    """The caller's identity and memberships for one request."""

    user_id: uuid.UUID
    email: str | None
    memberships: tuple[Membership, ...] = ()
    platform_role: str | None = None
    # The memberships are also indexed by school id for the lookups
    # that happen on every request.
    _by_school: dict[uuid.UUID, Membership] = field(default_factory=dict, repr=False)

    # ------------------------------------------------------------------
    # Lookup
    # ------------------------------------------------------------------
    def membership_for(self, school_id: uuid.UUID) -> Membership | None:
        """The caller's membership in a school, if any."""
        return self._by_school.get(school_id)

    def role_in(self, school_id: uuid.UUID) -> SchoolRole | None:
        """The caller's role in a school, if they belong to it."""
        membership = self._by_school.get(school_id)
        return membership.role if membership else None

    @property
    def is_platform_admin(self) -> bool:
        """True when the caller is a platform admin."""
        return self.platform_role == "platform_admin"

    @property
    def primary_school_id(self) -> uuid.UUID | None:
        """The school the caller is working in, by default."""
        primary = next((m for m in self.memberships if m.is_primary), None)
        if primary is not None:
            return primary.school_id
        return self.memberships[0].school_id if self.memberships else None

    @property
    def school_ids(self) -> tuple[uuid.UUID, ...]:
        """Every school the caller belongs to."""
        return tuple(m.school_id for m in self.memberships)

    # ------------------------------------------------------------------
    # Assertions
    # ------------------------------------------------------------------
    def require_membership(self, school_id: uuid.UUID) -> Membership:
        """Return the caller's membership in a school, or refuse.

        Raises NotFoundError rather than ForbiddenError when the
        caller has no membership at all: a 404 does not confirm that
        the school exists, so the endpoint cannot be used to probe
        for other tenants' ids.
        """
        membership = self._by_school.get(school_id)
        if membership is None:
            raise NotFoundError("Not found.")
        return membership

    def require_role(
        self,
        school_id: uuid.UUID,
        *roles: SchoolRole,
    ) -> Membership:
        """Return the caller's membership, if they hold one of the roles.

        Raises ForbiddenError when the caller belongs to the school
        but with a different role: they know the school exists, so
        there is nothing to hide.
        """
        membership = self.require_membership(school_id)
        if roles and membership.role not in roles:
            raise ForbiddenError(
                "You do not have permission to perform this action.",
                code="insufficient_role",
            )
        return membership

    def require_platform_admin(self) -> None:
        """Raise unless the caller is a platform admin."""
        if not self.is_platform_admin:
            raise ForbiddenError(
                "This action is restricted to platform administrators.",
                code="platform_admin_required",
            )

    def require_any_membership(self) -> Membership:
        """Return the caller's primary membership, or refuse."""
        if not self.memberships:
            raise ForbiddenError(
                "You do not belong to any school.",
                code="no_membership",
            )
        primary = next((m for m in self.memberships if m.is_primary), None)
        return primary or self.memberships[0]


async def load_context(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    email: str | None = None,
) -> RequestContext:
    """Load the caller's context from the database.

    The memberships are the active ones: a revoked membership grants
    nothing.
    """
    memberships_result = await session.execute(
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
    rows = list(memberships_result.scalars().all())

    memberships = tuple(
        Membership(
            id=row.id,
            school_id=row.school_id,
            role=row.role,
            is_primary=row.is_primary,
            joined_at=row.joined_at,
        )
        for row in rows
    )

    platform_result = await session.execute(
        select(PlatformRole).where(PlatformRole.user_id == user_id)
    )
    platform_role = platform_result.scalar_one_or_none()

    return RequestContext(
        user_id=user_id,
        email=email,
        memberships=memberships,
        platform_role=platform_role.role.value if platform_role else None,
        _by_school={m.school_id: m for m in memberships},
    )


__all__ = [
    "Membership",
    "RequestContext",
    "load_context",
]
