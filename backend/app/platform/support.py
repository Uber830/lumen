"""The support desk of the platform role.

What reaches the platform team from the schools is not a log line but
a case: someone asks for something, the team answers, and the whole
conversation stays written down.

The rules live here, not in the router:

- the code of a case is "SOL-1042";
- the levels are "info", "warning" and "urgent";
- the states are "open", "waiting" and "resolved";
- answering a case that was closed reopens it, because a school that
  writes again did not get its answer.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import ColumnElement, Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import AuditLog, School, SupportCase, SupportMessage

# The number the first case gets.
FIRST_CASE_NUMBER = 1001

# The levels a case can have, from the quietest to the loudest.
CASE_LEVELS: tuple[str, ...] = ("info", "warning", "urgent")

# The states a case can be in.
CASE_STATUSES: tuple[str, ...] = ("open", "waiting", "resolved")

# How the case arrived.
CASE_CHANNELS: tuple[str, ...] = ("web_form", "email", "call")

DEFAULT_PER_PAGE = 8
MAX_PER_PAGE = 50


@dataclass(frozen=True, slots=True)
class CaseRow:
    """One case of the listing, with what it shows in the table."""

    case: SupportCase
    school_name: str | None
    message_count: int
    last_message_at: datetime | None


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
        conditions.append(
            SupportCase.subject.ilike(pattern)
            | SupportCase.code.ilike(pattern)
            | SupportCase.requester_name.ilike(pattern)
        )
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
        .order_by(SupportCase.created_at.desc(), SupportCase.code)
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

    counts = await _message_counts(session, [case.id for case in cases])

    rows: list[CaseRow] = []
    for case in cases:
        rows.append(
            CaseRow(
                case=case,
                school_name=schools.get(case.school_id) if case.school_id else None,
                message_count=counts.get(case.id, (0, None))[0],
                last_message_at=counts.get(case.id, (0, None))[1],
            )
        )
    return rows, count


async def _message_counts(
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


async def get_case(session: AsyncSession, case_id: uuid.UUID) -> SupportCase | None:
    """One case with its conversation."""
    result = await session.execute(
        select(SupportCase)
        .options(selectinload(SupportCase.messages))
        .where(SupportCase.id == case_id)
        .execution_options(populate_existing=True)
    )
    return result.scalars().first()


async def answer_case(
    session: AsyncSession,
    *,
    case: SupportCase,
    author_id: uuid.UUID | None,
    author_name: str,
    body: str,
) -> SupportMessage:
    """Write the answer of the platform team in a case.

    A closed case reopens: the school wrote again, so it is waiting
    for an answer.
    """
    message = SupportMessage(
        case_id=case.id,
        author_id=author_id,
        author_name=author_name,
        author_role="Plataforma",
        body=body.strip(),
    )
    session.add(message)

    case.status = "waiting"
    case.resolved_at = None
    return message


async def resolve_case(session: AsyncSession, *, case: SupportCase) -> SupportCase:
    """Close a case."""
    case.status = "resolved"
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
    "CASE_CHANNELS",
    "CASE_LEVELS",
    "CASE_STATUSES",
    "CaseRow",
    "answer_case",
    "case_state_changed",
    "get_case",
    "list_cases",
    "next_case_code",
    "resolve_case",
    "school_audit",
]
