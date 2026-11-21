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

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.admin_permissions import permissions_for
from app.core.context import Membership, RequestContext
from app.core.errors import NotFoundError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context
from app.school import operations
from app.school.schemas import (
    AdminSchoolOut,
    AdminUserOut,
    CurrentPeriodOut,
    MaterialDetailOut,
    MaterialPage,
    SchoolAdminMe,
    SchoolOverview,
)

router = APIRouter(prefix="/v1/school", tags=["school"])


def _require_admin(context: RequestContext) -> Membership:
    """The membership of the administrator, or a refusal.

    The school comes from the session. The caller that belongs to a
    school but not as an administrator gets a 403: it already knows
    the school exists, so there is nothing to hide.
    """
    from app.core.errors import ForbiddenError

    membership = context.require_any_membership()
    if membership.role != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only school administrators can see this panel.",
            code="insufficient_role",
        )
    return membership


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
    membership = _require_admin(context)

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


@router.get("/material", response_model=MaterialPage)
async def list_school_material(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(description="Título, área o ID del material")] = None,
    area: Annotated[str | None, Query(description="El área del material")] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=50)] = 6,
) -> MaterialPage:
    """The material enabled for the school.

    Read only: the school consumes the material, it does not publish
    it. The filters and the pagination run in the server.
    """
    membership = _require_admin(context)
    page_data = await operations.list_material(
        session,
        membership.school_id,
        query=q,
        area=area,
        page=page,
        per_page=per_page,
    )
    return MaterialPage.model_validate(page_data)


@router.get("/material/{material_id}", response_model=MaterialDetailOut)
async def get_school_material(
    material_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MaterialDetailOut:
    """One material of the school, with its access confirmed.

    A material that is not enabled for this school answers 404: the
    endpoint must not confirm that the material of another school
    exists.
    """
    membership = _require_admin(context)
    material = await operations.get_material(session, membership.school_id, material_id)
    if material is None:
        raise NotFoundError("Material not found.")
    return MaterialDetailOut.model_validate(material)


@router.get("/overview", response_model=SchoolOverview)
async def school_overview(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SchoolOverview:
    """Return the dashboard of the school in a single call.

    The dashboard is the view that suffers the most in mobile, so it
    asks for everything at once instead of four round trips: the
    indicators, the material by area, the state of the school and the
    recent activity.

    Every number is counted from the rows of the caller's own school.
    """
    membership = _require_admin(context)
    overview = await operations.get_overview(session, membership.school_id)
    return SchoolOverview.model_validate(overview)


