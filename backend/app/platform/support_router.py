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
from app.db.models import Profile, School, User
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
        title=case.title,
        category=case.category,
        school_id=case.school_id,
        school_name=row.school_name,
        opened_by=case.opened_by,
        opened_by_name=row.opened_by_name,
        channel=case.channel,
        level=case.level,
        status=case.status,
        message_count=row.message_count,
        last_message_at=row.last_message_at,
        opened_at=case.opened_at,
    )


async def _detail(
    session: AsyncSession,
    thread: support.CaseThread,
    *,
    school_name: str | None = None,
    message_count: int | None = None,
    last_message_at: datetime | None = None,
) -> CaseDetail:
    """The whole case: the conversation and the movements of the platform."""
    case = thread.case

    if school_name is None and case.school_id is not None:
        school = await session.get(School, case.school_id)
        school_name = school.name if school is not None else None

    audit = await support.school_audit(session, case.school_id) if case.school_id else []

    openers = await support.actor_names(
        session,
        [case.opened_by] if case.opened_by is not None else [],
    )
    authors = await support.actor_names(
        session,
        [message.author_id for message in thread.messages if message.author_id is not None],
    )

    counts = await support.message_counts(session, [case.id])
    total, last_at = counts.get(case.id, (0, None))

    return CaseDetail(
        **_summary(
            support.CaseRow(
                case=case,
                school_name=school_name,
                message_count=message_count if message_count is not None else total,
                last_message_at=last_message_at if last_message_at is not None else last_at,
                opened_by_name=(
                    openers.get(case.opened_by, "Colegio") if case.opened_by else "Colegio"
                ),
            )
        ).model_dump(),
        messages=[
            CaseMessageOut(
                id=message.id,
                author_id=message.author_id,
                author_name=(
                    authors.get(message.author_id, "Colegio") if message.author_id else "Colegio"
                ),
                author_role=message.author_role,
                body=message.body,
                created_at=message.created_at,
            )
            for message in thread.messages
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
        can_resolve=case.status != "resuelto",
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
    thread = await support.get_case(session, case_id)
    if thread is None:
        raise NotFoundError("The case does not exist.")
    return await _detail(session, thread)


@router.post("/cases/{case_id}/messages", response_model=CaseDetail)
async def answer_case(
    case_id: uuid.UUID,
    body: ReplyRequest,
    context: Annotated[RequestContext, Depends(require_platform_admin)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> CaseDetail:
    """Answer a case.

    The answer is written in the conversation of the case and the case
    goes back to "en_espera": the school has the ball.
    """
    thread = await support.get_case(session, case_id)
    if thread is None:
        raise NotFoundError("The case does not exist.")

    await support.answer_case(
        session,
        case=thread.case,
        author_id=context.user_id,
        body=body.body,
    )
    await catalog.record_audit(
        session,
        event_type="support.case_answered",
        actor_id=context.user_id,
        actor_name=await _actor_name(session, context.user_id),
        school_id=thread.case.school_id,
        subject_type="support_case",
        subject_id=thread.case.id,
        detail={"code": thread.case.code, "title": thread.case.title},
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
    thread = await support.get_case(session, case_id)
    if thread is None:
        raise NotFoundError("The case does not exist.")

    previous = thread.case.status
    await support.resolve_case(session, case=thread.case)
    await catalog.record_audit(
        session,
        event_type="support.case_resolved",
        actor_id=context.user_id,
        actor_name=await _actor_name(session, context.user_id),
        school_id=thread.case.school_id,
        subject_type="support_case",
        subject_id=thread.case.id,
        detail={"code": thread.case.code, "from": previous, "to": thread.case.status},
    )
    await session.commit()

    refreshed = await support.get_case(session, case_id)
    assert refreshed is not None
    return await _detail(session, refreshed)


__all__ = ["router"]
