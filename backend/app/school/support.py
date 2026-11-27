"""The channel between the school and the support team.

The school opens the request and the platform team answers it in the
same thread. The school can add information, but it never resolves a
case: that is the platform team's decision, and the interface does not
offer the button.

Every query filters by the school of the session token. A school never
sees the cases of another one, and the code of a case is the one the
school sees in its own list.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import Integer, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import func as sql_func

from app.core.errors import NotFoundError, ValidationError
from app.db.models import Profile, SupportCase, SupportMessage, User
from app.notifications.service import (
    notify_support_case_answered,
    notify_support_case_opened,
)

# The categories a school can pick when it opens a request.
CATEGORIES = ("problema_tecnico", "solicitud_material", "duda_acceso", "otro")


async def list_cases(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    query: str | None = None,
    page: int = 1,
    per_page: int = 10,
) -> dict[str, Any]:
    """The requests of the school, the open ones first.

    The list is cut in the server, like the courses and the assignments:
    the browser asks for one page, not for everything. The search runs
    here too: it looks for the title or the code of the request.
    """
    page = max(1, page)
    per_page = max(1, min(per_page, 50))

    conditions = [SupportCase.school_id == school_id]
    needle = (query or "").strip()
    if needle:
        pattern = f"%{needle}%"
        conditions.append(or_(SupportCase.title.ilike(pattern), SupportCase.code.ilike(pattern)))
    ordering = (
        # The open ones come first, and the newest one is the first of
        # all.
        SupportCase.status.asc(),
        SupportCase.opened_at.desc(),
    )

    total = await session.execute(select(func.count()).select_from(SupportCase).where(*conditions))
    count = int(total.scalar_one())

    result = await session.execute(
        select(
            SupportCase.id,
            SupportCase.code,
            SupportCase.title,
            SupportCase.category,
            SupportCase.channel,
            SupportCase.level,
            SupportCase.status,
            SupportCase.opened_at,
            SupportCase.opened_by,
            Profile.full_name,
            User.email,
        )
        .outerjoin(Profile, Profile.id == SupportCase.opened_by)
        .outerjoin(User, User.id == SupportCase.opened_by)
        .where(*conditions)
        .order_by(*ordering)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )

    cases = [
        {
            "id": str(row[0]),
            "code": row[1],
            "title": row[2],
            "category": row[3],
            "channel": row[4],
            "level": row[5],
            "status": row[6],
            "opened_at": row[7],
            "opened_by": str(row[8]) if row[8] else None,
            "opened_by_name": row[9] or row[10] or "Colegio",
            "messages": 0,
        }
        for row in result.all()
    ]

    counts = await _message_counts(session, [uuid.UUID(case["id"]) for case in cases])
    for case in cases:
        case["messages"] = counts.get(uuid.UUID(case["id"]), 0)

    return {
        "items": cases,
        "total": count,
        "page": page,
        "per_page": per_page,
        "pages": (count + per_page - 1) // per_page if count else 0,
    }


async def open_case_count(session: AsyncSession, school_id: uuid.UUID) -> int:
    """How many requests of the school are still open.

    The bell of the panel shows this number: it counts every case of
    the school, not only the ones of the first page.
    """
    result = await session.execute(
        select(func.count())
        .select_from(SupportCase)
        .where(SupportCase.school_id == school_id, SupportCase.status != "resuelto")
    )
    return int(result.scalar_one())


async def _message_counts(
    session: AsyncSession,
    case_ids: list[uuid.UUID],
) -> dict[uuid.UUID, int]:
    """How many messages each case has in its thread."""
    if not case_ids:
        return {}

    result = await session.execute(
        select(SupportMessage.case_id, func.count(SupportMessage.id))
        .where(SupportMessage.case_id.in_(case_ids))
        .group_by(SupportMessage.case_id)
    )
    return {case_id: int(count) for case_id, count in result.all()}


async def get_case(
    session: AsyncSession,
    school_id: uuid.UUID,
    case_id: uuid.UUID,
) -> dict[str, Any]:
    """One case of the school, with its thread.

    A case of another school answers 404.
    """
    result = await session.execute(
        select(
            SupportCase.id,
            SupportCase.code,
            SupportCase.title,
            SupportCase.category,
            SupportCase.channel,
            SupportCase.level,
            SupportCase.status,
            SupportCase.opened_at,
            SupportCase.resolved_at,
            SupportCase.opened_by,
            Profile.full_name,
            User.email,
        )
        .outerjoin(Profile, Profile.id == SupportCase.opened_by)
        .outerjoin(User, User.id == SupportCase.opened_by)
        .where(
            SupportCase.school_id == school_id,
            SupportCase.id == case_id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise NotFoundError("Case not found.")

    (
        case_uuid,
        code,
        title,
        category,
        channel,
        level,
        status,
        opened_at,
        resolved_at,
        opened_by,
        full_name,
        email,
    ) = row

    messages = await _messages_of(session, case_uuid)

    return {
        "id": str(case_uuid),
        "code": code,
        "title": title,
        "category": category,
        "channel": channel,
        "level": level,
        "status": status,
        "opened_at": opened_at,
        "resolved_at": resolved_at,
        "opened_by": str(opened_by) if opened_by else None,
        "opened_by_name": full_name or email or "Colegio",
        "messages": messages,
    }


async def _messages_of(session: AsyncSession, case_id: uuid.UUID) -> list[dict[str, Any]]:
    """The thread of a case, oldest message first."""
    result = await session.execute(
        select(
            SupportMessage.id,
            SupportMessage.author_id,
            SupportMessage.author_role,
            SupportMessage.body,
            SupportMessage.created_at,
            Profile.full_name,
            User.email,
            SupportMessage.attachment_ids,
        )
        .outerjoin(Profile, Profile.id == SupportMessage.author_id)
        .outerjoin(User, User.id == SupportMessage.author_id)
        .where(SupportMessage.case_id == case_id)
        .order_by(SupportMessage.created_at)
    )

    return [
        {
            "id": str(row[0]),
            "author_id": str(row[1]) if row[1] else None,
            "author_role": row[2],
            # The name comes from the account of the author. When the
            # account is gone, the side that wrote it is the name.
            "author_name": row[5]
            or row[6]
            or ("Equipo Lumen" if row[2] == "plataforma" else "Colegio"),
            "body": row[3],
            "attachment_ids": list(row[7] or []),
            "created_at": row[4],
        }
        for row in result.all()
    ]


async def create_case(
    session: AsyncSession,
    school_id: uuid.UUID,
    user_id: uuid.UUID,
    *,
    title: str,
    category: str,
    body: str,
    attachment_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Open a request to the support team.

    The thread starts with the message of the administrator: the case
    is the message, and the platform team answers in the same thread.
    """
    title = title.strip()
    body = body.strip()

    if not title:
        raise ValidationError("Escribe el asunto de la solicitud.", code="missing_title")
    if not body:
        raise ValidationError("Escribe el mensaje de la solicitud.", code="missing_body")
    if category not in CATEGORIES:
        raise ValidationError("La categoría no es válida.", code="invalid_category")

    case = SupportCase(
        school_id=school_id,
        code=await _next_code(session),
        title=title,
        category=category,
        channel="formulario_colegio",
        level="info",
        status="abierto",
        opened_by=user_id,
    )
    session.add(case)
    await session.flush()

    session.add(
        SupportMessage(
            case_id=case.id,
            author_id=user_id,
            author_role="colegio",
            body=body,
            attachment_ids=list(attachment_ids or []),
        )
    )

    # The desk has to know that a case arrived: it is the bell of the
    # platform team that says it.
    await notify_support_case_opened(
        session,
        case=case,
        actor_name=await _actor_name(session, user_id=user_id),
    )

    await session.commit()

    return await get_case(session, school_id, case.id)


async def _actor_name(session: AsyncSession, *, user_id: uuid.UUID) -> str:
    """The name of the person who wrote, for the notification."""
    result = await session.execute(
        select(Profile.full_name, User.email)
        .join(Profile, Profile.id == User.id, isouter=True)
        .where(User.id == user_id)
    )
    row = result.first()
    if row is None:
        return "El colegio"
    return row[0] or row[1] or "El colegio"


async def _next_code(session: AsyncSession) -> str:
    """The next code of a case: SOL-1043.

    The number follows the highest one already in use, so the code
    reads like the ones the support team already uses and never repeats
    one that was used before.
    """
    result = await session.execute(
        select(func.max(cast(sql_func.right(SupportCase.code, 4), Integer))).where(
            SupportCase.code.regexp_match(r"^SOL-[0-9]+$")
        )
    )
    highest = result.scalar() or 1042
    return f"SOL-{int(highest) + 1}"


async def add_message(
    session: AsyncSession,
    school_id: uuid.UUID,
    case_id: uuid.UUID,
    user_id: uuid.UUID,
    body: str,
    attachment_ids: list[str] | None = None,
) -> dict[str, Any]:
    """Add information to the thread of a case.

    The case has to belong to the school of the session. The school
    adds information: it does not resolve the case.
    """
    body = body.strip()
    if not body:
        raise ValidationError("Escribe el mensaje.", code="missing_body")

    result = await session.execute(
        select(SupportCase.id).where(
            SupportCase.school_id == school_id,
            SupportCase.id == case_id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise NotFoundError("Case not found.")

    session.add(
        SupportMessage(
            case_id=case_id,
            author_id=user_id,
            author_role="colegio",
            body=body,
            attachment_ids=list(attachment_ids or []),
        )
    )

    # The school wrote in the thread: the desk has to know it.
    case = await session.get(SupportCase, case_id)
    if case is not None:
        await notify_support_case_answered(
            session,
            case=case,
            actor_name=await _actor_name(session, user_id=user_id),
        )

    await session.commit()

    return await get_case(session, school_id, case_id)


__all__ = ["add_message", "create_case", "get_case", "list_cases"]
