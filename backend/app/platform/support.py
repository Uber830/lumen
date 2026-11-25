"""The support desk of the platform role.

What reaches the platform team from the schools is not a log line but
a case: someone asks for something, the team answers, and the whole
conversation stays written down.

The rules live here, not in the router:

- the code of a case is "SOL-1042";
- the levels are "info", "aviso" and "urgente";
- the states are "abierto", "en_espera" and "resuelto";
- answering a case that was closed reopens it, because a school that
  writes again did not get its answer.

The desk speaks the vocabulary of the product: the same table and the
same names that the school uses on its side. The case has a title, a
category and a thread that opens with the message of the school.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import ColumnElement, Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditLog, Profile, School, SupportCase, SupportMessage, User
from app.notifications.service import notify_support_case_replied

# The number the first case gets.
FIRST_CASE_NUMBER = 1001

# The levels a case can have, from the quietest to the loudest.
CASE_LEVELS: tuple[str, ...] = ("info", "aviso", "urgente")

# The states a case can be in.
CASE_STATUSES: tuple[str, ...] = ("abierto", "en_espera", "resuelto")

# How the case arrived.
CASE_CHANNELS: tuple[str, ...] = (
    "formulario_colegio",
    "formulario_web",
    "correo",
    "llamada",
)

# The kinds of request a school opens.
CASE_CATEGORIES: tuple[str, ...] = (
    "problema_tecnico",
    "solicitud_material",
    "duda_acceso",
    "otro",
)

DEFAULT_PER_PAGE = 8
MAX_PER_PAGE = 50


@dataclass(frozen=True, slots=True)
class CaseRow:
    """One case of the listing, with what it shows in the table."""

    case: SupportCase
    school_name: str | None
    message_count: int
    last_message_at: datetime | None
    opened_by_name: str = "Colegio"


@dataclass(frozen=True, slots=True)
class CaseThread:
    """One case with its conversation."""

    case: SupportCase
    messages: list[SupportMessage] = field(default_factory=list)


async def next_case_code(session: AsyncSession) -> str:
    """The code of the next case: "SOL-1042".

    The number is the highest one in use plus one. The code is unique,
    so a race that takes the same number is rejected by the database
    and the caller can try again.
    """
    result = await session.execute(
        select(func.max(cast(func.substring(SupportCase.code, 5), Integer)))
    )
    highest = result.scalar_one_or_none()
    number = FIRST_CASE_NUMBER if highest is None else int(highest) + 1
    return f"SOL-{number}"


async def list_cases(
    session: AsyncSession,
    *,
    query: str | None = None,
    status: str | None = None,
    level: str | None = None,
    school_id: uuid.UUID | None = None,
    page: int = 1,
    per_page: int = DEFAULT_PER_PAGE,
) -> tuple[list[CaseRow], int]:
    """The cases of the desk, filtered and paginated."""
    conditions: list[ColumnElement[bool]] = []
    if query:
        pattern = f"%{query.strip()}%"
        conditions.append(SupportCase.title.ilike(pattern) | SupportCase.code.ilike(pattern))
    if status:
        conditions.append(SupportCase.status == status)
    if level:
        conditions.append(SupportCase.level == level)
    if school_id:
        conditions.append(SupportCase.school_id == school_id)

    total = await session.execute(select(func.count()).select_from(SupportCase).where(*conditions))
    count = int(total.scalar_one())

    result = await session.execute(
        select(SupportCase)
        .where(*conditions)
        .order_by(SupportCase.opened_at.desc(), SupportCase.code)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    cases = list(result.scalars().all())

    schools: dict[uuid.UUID, str] = {}
    if cases:
        school_ids = [case.school_id for case in cases if case.school_id is not None]
        if school_ids:
            names = await session.execute(
                select(School.id, School.name).where(School.id.in_(school_ids))
            )
            schools = {school_id: name for school_id, name in names.all()}

    counts = await message_counts(session, [case.id for case in cases])
    openers = await actor_names(
        session,
        [case.opened_by for case in cases if case.opened_by is not None],
    )

    rows: list[CaseRow] = []
    for case in cases:
        rows.append(
            CaseRow(
                case=case,
                school_name=schools.get(case.school_id) if case.school_id else None,
                message_count=counts.get(case.id, (0, None))[0],
                last_message_at=counts.get(case.id, (0, None))[1],
                opened_by_name=openers.get(case.opened_by, "Colegio")
                if case.opened_by
                else "Colegio",
            )
        )
    return rows, count


async def message_counts(
    session: AsyncSession,
    case_ids: list[uuid.UUID],
) -> dict[uuid.UUID, tuple[int, datetime | None]]:
    """How many messages each case has, and when the last one arrived."""
    if not case_ids:
        return {}

    result = await session.execute(
        select(
            SupportMessage.case_id,
            func.count(SupportMessage.id),
            func.max(SupportMessage.created_at),
        )
        .where(SupportMessage.case_id.in_(case_ids))
        .group_by(SupportMessage.case_id)
    )
    return {case_id: (int(total), last_at) for case_id, total, last_at in result.all()}


async def actor_names(
    session: AsyncSession,
    user_ids: list[uuid.UUID],
) -> dict[uuid.UUID, str]:
    """The name of each author of the thread."""
    if not user_ids:
        return {}

    result = await session.execute(
        select(User.id, Profile.full_name, User.email)
        .join(Profile, Profile.id == User.id, isouter=True)
        .where(User.id.in_(user_ids))
    )
    return {user_id: full_name or email or "Colegio" for user_id, full_name, email in result.all()}


async def _actor_name(session: AsyncSession, user_id: uuid.UUID | None) -> str:
    """The name of the author, for the notification of the school."""
    if user_id is None:
        return "El equipo de Lumen"
    result = await session.execute(
        select(Profile.full_name, User.email)
        .join(Profile, Profile.id == User.id, isouter=True)
        .where(User.id == user_id)
    )
    row = result.first()
    if row is None:
        return "El equipo de Lumen"
    return row[0] or row[1] or "El equipo de Lumen"


async def get_case(session: AsyncSession, case_id: uuid.UUID) -> CaseThread | None:
    """One case with its conversation."""
    result = await session.execute(
        select(SupportCase)
        .where(SupportCase.id == case_id)
        .execution_options(populate_existing=True)
    )
    case = result.scalars().first()
    if case is None:
        return None

    messages = await session.execute(
        select(SupportMessage)
        .where(SupportMessage.case_id == case_id)
        .order_by(SupportMessage.created_at)
    )
    return CaseThread(case=case, messages=list(messages.scalars().all()))


async def answer_case(
    session: AsyncSession,
    *,
    case: SupportCase,
    author_id: uuid.UUID | None,
    body: str,
    attachment_ids: list[str] | None = None,
) -> SupportMessage:
    """Write the answer of the platform team in a case.

    A closed case reopens: the school wrote again, so it is waiting
    for an answer.

    The answer may carry files: the support team answers with a
    document (a guide, a capture of the fix) as well as with words.
    """
    message = SupportMessage(
        case_id=case.id,
        author_id=author_id,
        author_role="plataforma",
        body=body.strip(),
        attachment_ids=list(attachment_ids or []),
    )
    session.add(message)

    # The school opened the case and waits for the answer: the bell of
    # the administrators of the school says that it is there.
    await notify_support_case_replied(
        session,
        case=case,
        actor_name=await _actor_name(session, author_id),
    )

    case.status = "en_espera"
    case.resolved_at = None
    return message


async def resolve_case(session: AsyncSession, *, case: SupportCase) -> SupportCase:
    """Close a case."""
    case.status = "resuelto"
    case.resolved_at = datetime.now(UTC)
    return case


async def school_audit(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    limit: int = 10,
) -> list[AuditLog]:
    """The last movements of the platform for a school."""
    result = await session.execute(
        select(AuditLog)
        .where(AuditLog.school_id == school_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


def case_state_changed(case: SupportCase, previous: str) -> dict[str, Any]:
    """What changed in the case, for the audit trail."""
    return {
        "code": case.code,
        "from": previous,
        "to": case.status,
        "school": case.school_id,
    }


__all__ = [
    "CASE_CATEGORIES",
    "CASE_CHANNELS",
    "CASE_LEVELS",
    "CASE_STATUSES",
    "CaseRow",
    "CaseThread",
    "actor_names",
    "answer_case",
    "case_state_changed",
    "get_case",
    "list_cases",
    "message_counts",
    "next_case_code",
    "resolve_case",
    "school_audit",
]
