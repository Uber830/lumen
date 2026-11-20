"""The models of the support desk of the platform role.

- `support_cases`    — a case the platform team answers for a school.
- `support_messages` — the conversation of the case, one message per turn.

The cases are the counterpart of the audit trail: the audit says what
the platform team did, and the cases say what the schools asked and
what was answered.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at, updated_at


class SupportCase(Base):
    """A case the platform team answers.

    The case keeps the state of the conversation: "open" when nobody
    answered yet, "waiting" when the team did and the school has the
    ball, and "resolved" when the matter is closed.
    """

    __tablename__ = "support_cases"
    __table_args__ = ({"schema": "public"},)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # The readable identifier the support team uses: "SOL-1042".
    code: Mapped[str] = mapped_column(String(12), nullable=False)
    subject: Mapped[str] = mapped_column(String(240), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    requester_name: Mapped[str] = mapped_column(String(160), nullable=False)
    requester_role: Mapped[str] = mapped_column(String(80), nullable=False)
    channel: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="web_form",
        server_default=text("'web_form'"),
    )
    # "info", "warning" or "urgent".
    level: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="info",
        server_default=text("'info'"),
    )
    # "open", "waiting" or "resolved".
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="open",
        server_default=text("'open'"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    messages: Mapped[list[SupportMessage]] = relationship(
        back_populates="case",
        cascade="all, delete-orphan",
        order_by="SupportMessage.created_at",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SupportCase {self.code}>"


class SupportMessage(Base):
    """One turn of the conversation of a case."""

    __tablename__ = "support_messages"
    __table_args__ = ({"schema": "public"},)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.support_cases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The author of the message. It is null when the account was
    # removed, but the name of the author stays written down.
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    author_name: Mapped[str] = mapped_column(String(160), nullable=False)
    # What the author does: "Docente", "Administradora", "Plataforma"...
    author_role: Mapped[str] = mapped_column(String(80), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at()

    case: Mapped[SupportCase] = relationship(back_populates="messages")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SupportMessage {self.case_id}>"


__all__ = ["SupportCase", "SupportMessage"]
