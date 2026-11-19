"""The router of the school administrator.

Endpoints
---------

- GET /v1/school/me: who the caller is, the school it administers,
  its rank and the permissions that come with it.

The school is always the caller's own: it comes from the session
token, never from the request. A caller that does not administer a
school gets a 404, so the endpoint cannot be used to find out which
schools exist.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_permissions import permissions_for
from app.core.context import RequestContext
from app.core.errors import NotFoundError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context
from app.school import operations
from app.school.schemas import (
    AdminSchoolOut,
    AdminUserOut,
    CurrentPeriodOut,
    SchoolAdminMe,
)

router = APIRouter(prefix="/v1/school", tags=["school"])


@router.get("/me", response_model=SchoolAdminMe)
async def school_me(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolAdminMe:
    """Return the context of the administrator.

    The response carries the `permissions` of the rank of the caller:
    the frontend shows what is on the list and disables the rest with
    its reason.
    """
    membership = context.require_any_membership()
    if membership.role != SchoolRole.SCHOOL_ADMIN:
        # The caller belongs to a school, but not as an administrator:
        # it knows the school exists, so a 403 is honest here.
        from app.core.errors import ForbiddenError

        raise ForbiddenError(
            "Only school administrators can see this panel.",
            code="insufficient_role",
        )

    school = await operations.get_school(session, membership.school_id)
    if school is None:
        raise NotFoundError("School not found.")

    user = await operations.get_user(session, context.user_id)
    profile = await operations.get_profile(session, context.user_id)
    entitlement = await operations.get_entitlement(session, membership.school_id)
    period = await operations.get_current_period(session, membership.school_id)

    return SchoolAdminMe(
        user=AdminUserOut(
            id=context.user_id,
            email=context.email or (user.email if user else ""),
            full_name=(profile.full_name if profile else None)
            or (user.full_name if user else None),
            phone=profile.phone if profile else None,
            avatar_url=profile.avatar_url if profile else None,
        ),
        admin_role=membership.admin_role.value if membership.admin_role else None,
        school=AdminSchoolOut(
            id=school.id,
            name=school.name,
            display_name=school.display_name,
            short_code=school.short_code,
            status=school.status.value,
            logo_url=school.logo_url,
            primary_color=school.primary_color,
            plan_code=entitlement.plan_code if entitlement else None,
            plan_name=entitlement.plan_name if entitlement else None,
        ),
        permissions=permissions_for(membership.admin_role),
        current_period=(
            CurrentPeriodOut(
                id=period.id,
                name=period.name,
                start_date=period.start_date,
                end_date=period.end_date,
                delivery_modality=(
                    period.delivery_modality.value if period.delivery_modality else None
                ),
                closed_at=period.closed_at,
            )
            if period
            else None
        ),
    )


__all__ = ["router"]
