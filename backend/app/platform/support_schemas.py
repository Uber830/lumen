"""Pydantic models of the support desk of the platform role.

The closed vocabularies of the module (levels, states, channels) travel
with the options endpoint, so that the frontend never hardcodes them.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.platform import support


class CaseOptions(BaseModel):
    """The closed catalogs of the support desk."""

    levels: list[str]
    statuses: list[str]
    channels: list[str]


class CaseMessageOut(BaseModel):
    """One turn of the conversation."""

    id: UUID
    author_name: str
    author_role: str
    body: str
    created_at: datetime


class CaseSummary(BaseModel):
    """One case of the listing."""

    id: UUID
    code: str
    subject: str
    school_id: UUID | None
    school_name: str | None
    requester_name: str
    requester_role: str
    channel: str
    level: str
    status: str
    message_count: int
    last_message_at: datetime | None
    created_at: datetime


class CasePage(BaseModel):
    """A page of cases."""

    items: list[CaseSummary]
    total: int
    page: int
    per_page: int


class AuditEventOut(BaseModel):
    """One movement of the platform, shown inside a case."""

    id: UUID
    event_type: str
    level: str
    actor_name: str | None
    detail: dict[str, object]
    created_at: datetime


class CaseDetail(CaseSummary):
    """The whole case: the description, the conversation and the audit."""

    detail: str | None
    messages: list[CaseMessageOut]
    audit: list[AuditEventOut]
    can_resolve: bool


class ReplyRequest(BaseModel):
    """The answer of the platform team."""

    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def _not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


def case_options() -> CaseOptions:
    """The closed catalogs of the module."""
    return CaseOptions(
        levels=list(support.CASE_LEVELS),
        statuses=list(support.CASE_STATUSES),
        channels=list(support.CASE_CHANNELS),
    )


__all__ = [
    "AuditEventOut",
    "CaseDetail",
    "CaseMessageOut",
    "CaseOptions",
    "CasePage",
    "CaseSummary",
    "ReplyRequest",
    "case_options",
]
