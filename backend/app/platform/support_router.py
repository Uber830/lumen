"""The support desk of the platform role.

The cases the schools open, the conversation of each one and the trail
of the movements of the platform for the school that opened it.

Every endpoint requires the platform role.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import NotFoundError
from app.db.models import Profile, School, SupportCase, User
from app.db.session import get_db
from app.deps import require_platform_admin
from app.platform import catalog, support
from app.platform.support_schemas import (
    AuditEventOut,
    CaseDetail,
    CaseMessageOut,
    CaseOptions,
    CasePage,
    CaseSummary,
    ReplyRequest,
    case_options,
)

router = APIRouter(prefix="/v1/platform", tags=["platform"])


async def _actor_name(session: AsyncSession, user_id: uuid.UUID | None) -> str:
    """The name of the platform team member who is answering."""
    if user_id is None:
        return "Equipo Lumen"
    result = await session.execute(
        select(Profile.full_name, User.email)
        .join(User, User.id == Profile.id, isouter=True)
        .where(User.id == user_id)
    )
    full_name, email = result.first() or (None, None)
    return full_name or email or "Equipo Lumen"


def _summary(row: support.CaseRow) -> CaseSummary:
    """One row of the listing."""
    case = row.case
    return CaseSummary(
        id=case.id,
        code=case.code,
        subject=case.subject,
        school_id=case.school_id,
        school_name=row.school_name,
        requester_name=case.requester_name,
        requester_role=case.requester_role,
        channel=case.channel,
        level=case.level,
        status=case.status,
        message_count=row.message_count,
        last_message_at=row.last_message_at,
        created_at=case.created_at,
    )


async def _detail(
    session: AsyncSession,
    case: SupportCase,
    *,
    school_name: str | None = None,
    message_count: int | None = None,
    last_message_at: datetime | None = None,
) -> CaseDetail:
    """The whole case: the conversation and the movements of the platform."""
    loaded = case

    if school_name is None and loaded.school_id is not None:
        school = await session.get(School, loaded.school_id)
        school_name = school.name if school is not None else None

    audit = await support.school_audit(session, loaded.school_id) if loaded.school_id else []

    return CaseDetail(
        **_summary(
            support.CaseRow(
                case=loaded,
                school_name=school_name,
                message_count=message_count if message_count is not None else len(loaded.messages),
                last_message_at=last_message_at,
            )
        ).model_dump(),
        detail=loaded.detail,
        messages=[
            CaseMessageOut(
                id=message.id,
                author_name=message.author_name,
                author_role=message.author_role,
                body=message.body,
                created_at=message.created_at,
            )
            for message in loaded.messages
        ],
        audit=[
            AuditEventOut(
                id=entry.id,
                event_type=entry.event_type,
                level=entry.level,
                actor_name=entry.actor_name,
                detail=entry.detail,
                created_at=entry.created_at,
            )
            for entry in audit
        ],
        can_resolve=loaded.status != "resolved",
    )


@router.get("/case-options", response_model=CaseOptions)
async def read_case_options(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
) -> CaseOptions:
    """The closed catalogs of the support desk."""
    return case_options()


@router.get("/cases", response_model=CasePage)
async def list_cases(
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
    q: Annotated[str | None, Query(max_length=120)] = None,
    status: Annotated[str | None, Query(max_length=16)] = None,
    level: Annotated[str | None, Query(max_length=16)] = None,
    school_id: Annotated[uuid.UUID | None, Query()] = None,
    page: Annotated[int, Query(ge=1)] = 1,
    per_page: Annotated[int, Query(ge=1, le=support.MAX_PER_PAGE)] = support.DEFAULT_PER_PAGE,
) -> CasePage:
    """The cases of the desk, filtered and paginated."""
    rows, total = await support.list_cases(
        session,
        query=q,
        status=status,
        level=level,
        school_id=school_id,
        page=page,
        per_page=per_page,
    )
    return CasePage(
        items=[_summary(row) for row in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/cases/{case_id}", response_model=CaseDetail)
async def read_case(
    case_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CaseDetail:
    """One case with its conversation."""
    case = await support.get_case(session, case_id)
    if case is None:
        raise NotFoundError("The case does not exist.")
    return await _detail(session, case)


@router.post("/cases/{case_id}/messages", response_model=CaseDetail)
async def answer_case(
    case_id: uuid.UUID,
    body: ReplyRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CaseDetail:
    """Answer a case.

    The answer is written in the conversation of the case and the case
    goes back to "waiting": the school has the ball.
    """
    case = await support.get_case(session, case_id)
    if case is None:
        raise NotFoundError("The case does not exist.")

    await support.answer_case(
        session,
        case=case,
        author_id=context.user_id,
        author_name=await _actor_name(session, context.user_id),
        body=body.body,
    )
    await catalog.record_audit(
        session,
        event_type="support.case_answered",
        actor_id=context.user_id,
        actor_name=await _actor_name(session, context.user_id),
        school_id=case.school_id,
        subject_type="support_case",
        subject_id=case.id,
        detail={"code": case.code, "subject": case.subject},
    )
    await session.commit()

    refreshed = await support.get_case(session, case_id)
    assert refreshed is not None
    return await _detail(session, refreshed)


@router.post("/cases/{case_id}/resolve", response_model=CaseDetail)
async def resolve_case(
    case_id: uuid.UUID,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CaseDetail:
    """Close a case."""
    case = await support.get_case(session, case_id)
    if case is None:
        raise NotFoundError("The case does not exist.")

    previous = case.status
    await support.resolve_case(session, case=case)
    await catalog.record_audit(
        session,
        event_type="support.case_resolved",
        actor_id=context.user_id,
        actor_name=await _actor_name(session, context.user_id),
        school_id=case.school_id,
        subject_type="support_case",
        subject_id=case.id,
        detail={"code": case.code, "from": previous, "to": case.status},
    )
    await session.commit()

    refreshed = await support.get_case(session, case_id)
    assert refreshed is not None
    return await _detail(session, refreshed)


__all__ = ["router"]
