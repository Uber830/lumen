"""The team of administrators of the school.

Two ranks live inside the school, and the difference has to be visible
in the interface and not only in the backend:

- **principal**: runs the school. It closes the academic periods,
  invites the rest of the team and changes the identity of the school.
- **secundario**: helps with the community and the academic structure.

The school always keeps **one principal**: the rank is handed over from
one person to another, and the team cannot demote or remove the last
one, because then nobody would be able to close a period, invite a
colleague or change the identity.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_permissions import PERMISSION_LABELS, SchoolPermission, permissions_for
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.enums import SchoolAdminRole, SchoolRole
from app.db.models import Profile, SchoolMembership, User


async def list_admins(session: AsyncSession, school_id: uuid.UUID) -> list[dict[str, Any]]:
    """The administrators of the school, with their rank.

    Each one carries the permissions of its rank, so the detail can
    show what the rank can do instead of leaving it implicit.
    """
    result = await session.execute(
        select(
            SchoolMembership.id,
            SchoolMembership.user_id,
            SchoolMembership.admin_role,
            SchoolMembership.revoked_at,
            SchoolMembership.joined_at,
            Profile.full_name,
            User.email,
            User.password_hash,
        )
        .outerjoin(Profile, Profile.id == SchoolMembership.user_id)
        .join(User, User.id == SchoolMembership.user_id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == SchoolRole.SCHOOL_ADMIN,
        )
        .order_by(SchoolMembership.admin_role.asc(), Profile.full_name.asc())
    )

    admins = []
    for row in result.all():
        (
            membership_id,
            user_id,
            admin_role,
            revoked_at,
            joined_at,
            full_name,
            email,
            password_hash,
        ) = row
        rank = admin_role or SchoolAdminRole.PRINCIPAL
        admins.append(
            {
                "membership_id": str(membership_id),
                "user_id": str(user_id),
                "full_name": full_name or (email or "Administrador"),
                "email": email,
                "joined_at": joined_at,
                "admin_role": rank.value,
                "status": "inactivo" if revoked_at is not None else "activo",
                "account_activated": bool(password_hash),
                # What this rank may do, spelled out for the detail:
                # the string is the contract with the interface, and
                # the label is what the person reads.
                "permissions": [
                    {
                        "permission": permission,
                        "label": PERMISSION_LABELS.get(SchoolPermission(permission), permission),
                    }
                    for permission in permissions_for(rank)
                ],
            }
        )

    return admins


async def count_principals(session: AsyncSession, school_id: uuid.UUID) -> int:
    """How many active principals the school has."""
    result = await session.execute(
        select(func.count(SchoolMembership.id)).where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == SchoolRole.SCHOOL_ADMIN,
            SchoolMembership.admin_role == SchoolAdminRole.PRINCIPAL,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    return int(result.scalar() or 0)


async def set_rank(
    session: AsyncSession,
    school_id: uuid.UUID,
    membership_id: uuid.UUID,
    admin_role: SchoolAdminRole,
) -> dict[str, Any]:
    """Change the rank of an administrator.

    The school has **one** principal: the rank is handed over, never
    duplicated, so promoting somebody while there is already a
    principal is refused. The last principal cannot be demoted either:
    the school would be left without anyone able to close a period or
    invite a colleague.
    """
    membership = await _membership_of(session, school_id, membership_id)

    if membership.admin_role == admin_role:
        return {"membership_id": str(membership.id), "admin_role": admin_role.value}

    if admin_role == SchoolAdminRole.PRINCIPAL:
        principals = await count_principals(session, school_id)
        if principals > 0:
            raise ConflictError(
                "El colegio tiene un solo administrador principal. "
                "Para pasárselo a esta persona, cede el tuyo: "
                "ella quedará como principal y tú como secundario.",
                code="only_one_principal",
            )

    if membership.admin_role == SchoolAdminRole.PRINCIPAL:
        principals = await count_principals(session, school_id)
        if principals <= 1:
            raise ConflictError(
                "El colegio debe tener al menos un administrador principal.",
                code="last_principal",
            )

    membership.admin_role = admin_role
    await session.commit()
    return {"membership_id": str(membership.id), "admin_role": admin_role.value}


async def transfer_principal(
    session: AsyncSession,
    school_id: uuid.UUID,
    giver_membership_id: uuid.UUID,
    target_membership_id: uuid.UUID,
) -> dict[str, Any]:
    """Hand the principal rank over to another administrator.

    The rank moves from one person to another in a single step, so the
    school is never left without a principal. The administrator who
    gives it away stays in the team, as a secondary.
    """
    giver = await _membership_of(session, school_id, giver_membership_id)
    target = await _membership_of(session, school_id, target_membership_id)

    if giver.id == target.id:
        raise ValidationError(
            "El rango principal no se cede a uno mismo.",
            code="invalid_transfer",
        )

    if target.revoked_at is not None:
        raise ValidationError(
            "Esa persona ya no está en el equipo del colegio.",
            code="not_in_team",
        )

    if target.admin_role == SchoolAdminRole.PRINCIPAL:
        # Nothing to move: the school already has its single principal.
        return {"membership_id": str(target.id), "admin_role": target.admin_role.value}

    target.admin_role = SchoolAdminRole.PRINCIPAL
    giver.admin_role = SchoolAdminRole.SECUNDARIO
    await session.commit()
    return {"membership_id": str(target.id), "admin_role": target.admin_role.value}


async def remove(
    session: AsyncSession,
    school_id: uuid.UUID,
    membership_id: uuid.UUID,
) -> None:
    """Remove an administrator from the team.

    The last principal cannot be removed: the school would be left
    without anyone able to close a period or invite a colleague.
    """
    membership = await _membership_of(session, school_id, membership_id)

    if membership.admin_role == SchoolAdminRole.PRINCIPAL:
        principals = await count_principals(session, school_id)
        if principals <= 1:
            raise ConflictError(
                "El colegio debe tener al menos un administrador principal.",
                code="last_principal",
            )

    membership.revoked_at = func.now()
    await session.commit()


async def _membership_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    membership_id: uuid.UUID,
) -> SchoolMembership:
    """Load one membership of the school."""
    result = await session.execute(
        select(SchoolMembership).where(
            SchoolMembership.id == membership_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == SchoolRole.SCHOOL_ADMIN,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError("Administrator not found.")
    return membership


__all__ = ["count_principals", "list_admins", "remove", "set_rank", "transfer_principal"]
