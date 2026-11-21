"""The channel between a school and the support team.

- `support_cases`    the requests the school opens, with their state.
- `support_messages` the thread of each case.

The case is opened by the school and answered by the platform team in
the same thread. The school answers and adds information; it never
resolves the case, because that is the platform team's decision.

The `school_id` always comes from the session token: the client never
sends it, and a school never sees the cases of another one.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at


class SupportCase(Base):
    """A request of the school to the support team."""

    __tablename__ = "support_cases"
    __table_args__ = (
        UniqueConstraint("code", name="support_cases_code_uq"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The short code shown in the tables: SOL-1043.
    code: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    # problema_tecnico, solicitud_material, duda_acceso or otro.
    category: Mapped[str] = mapped_column(Text, nullable=False, default="otro")
    # formulario_colegio, formulario_web, correo or llamada.
    channel: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="formulario_colegio",
    )
    # info, aviso or urgente.
    level: Mapped[str] = mapped_column(Text, nullable=False, default="info")
    # abierto, en_espera or resuelto.
    status: Mapped[str] = mapped_column(Text, nullable=False, default="abierto")
    # Who opened it. Null when it was opened by the platform team.
    opened_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    opened_at: Mapped[datetime] = created_at()
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )


class SupportMessage(Base):
    """A message of the thread of a case.

    Both sides write in the same thread: the platform team answers and
    resolves, the school answers and adds information.
    """

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
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # colegio or plataforma: who wrote it.
    author_role: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="colegio",
        server_default=text("'colegio'"),
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at()


__all__ = ["SupportCase", "SupportMessage"]
