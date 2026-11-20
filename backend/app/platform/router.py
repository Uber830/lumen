"""Platform router: the endpoints only the platform team can use.

The schools are onboarded here, not by the users. A visitor of the
public site asks for access, and the platform team creates the school
from this module.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.session import get_db
from app.deps import require_platform_admin
from app.platform.operations import provision_school
from app.platform.schemas import ProvisionSchoolRequest, ProvisionSchoolResponse
from app.schools.operations import BootstrapError

router = APIRouter(prefix="/v1/platform", tags=["platform"])


@router.post(
    "/schools",
    response_model=ProvisionSchoolResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_school(
    body: ProvisionSchoolRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ProvisionSchoolResponse:
    """Create a school with its administrator.

    The response carries the activation link of the administrator: the
    account has no password until that link is used, so the team shares
    it with the school and nobody has to carry a password around.
    """
    try:
        provisioned = await provision_school(
            session,
            school_name=body.school_name,
            short_code=body.short_code,
            plan_code=body.plan_code,
            admin_email=body.admin_email,
            admin_name=body.admin_name,
            trial_days=body.trial_days,
            city=body.city,
        )
    except BootstrapError as exc:
        await session.rollback()
        # The business errors keep the SQLSTATE codes the frontend
        # already knows how to translate.
        if exc.code == "23505":
            raise ConflictError(exc.message, code="duplicate_school") from exc
        if exc.code == "P0002":
            raise NotFoundError(exc.message, code="plan_not_found") from exc
        raise ValidationError(exc.message, code="invalid_input") from exc

    await session.commit()

    return ProvisionSchoolResponse(
        school_id=provisioned.school_id,
        admin_user_id=provisioned.admin_user_id,
        admin_email=provisioned.admin_email,
        activation_token=provisioned.activation_token,
        activation_expires_at=provisioned.activation_expires_at,
    )


__all__ = ["router"]
