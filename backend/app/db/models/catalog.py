"""The models of the editorial catalog.

- `materials`         — the piece the platform team loads.
- `material_files`    — the files of the piece.
- `material_schools`  — the schools that can see it.
- `material_history`  — what happened to it and who did it.
- `audit_log`         — the trace of the critical events.

The closed catalogs (types, areas, grades) live in
`app.platform.catalog`: they are business vocabulary, not rows of a
table, and they are served to the frontend by
`GET /v1/platform/catalog-options` so that it never hardcodes them.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    ARRAY,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at, updated_at


class Material(Base):
    """A piece of the editorial catalog.

    The lifecycle is `draft -> review -> published -> archived`. The
    access is not a column of the material but a set of rows in
    `material_schools`: the platform team decides, colegio por colegio,
    who sees it.
    """

    __tablename__ = "materials"
    __table_args__ = (
        UniqueConstraint("code", name="materials_code_uq"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # The readable identifier: "C-1041".
    code: Mapped[str] = mapped_column(String(12), nullable=False)
    title: Mapped[str] = mapped_column(String(240), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    area: Mapped[str] = mapped_column(String(32), nullable=False)
    # The grades it applies to: "7°", "10°".
    grades: Mapped[list[str]] = mapped_column(
        ARRAY(Text),
        nullable=False,
        default=list,
        server_default=text("'{}'"),
    )
    # "all" (teachers and students) or "teachers" (only the teachers).
    visible_to: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="all",
        server_default=text("'all'"),
    )
    publication_year: Mapped[int | None] = mapped_column(
        SmallInteger,
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # "upload" or "link". A link is neither downloaded nor backed up.
    origin: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="upload",
        server_default=text("'upload'"),
    )
    external_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="draft",
        server_default=text("'draft'"),
    )
    # The editorial order of the landing.
    position: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    files: Mapped[list[MaterialFile]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
    )
    schools: Mapped[list[MaterialSchool]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
    )
    history: Mapped[list[MaterialHistory]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
        order_by="MaterialHistory.created_at",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Material {self.code}>"


class MaterialFile(Base):
    """One file of a material.

    A file whose `material_id` is null is one that was uploaded but not
    attached yet: the upload assistant collects the files before the
    piece that carries them exists.
    """

    __tablename__ = "material_files"
    __table_args__ = ({"schema": "public"},)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.materials.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # The key of the object in the storage, never the public address.
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)
    file_name: Mapped[str] = mapped_column(Text, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    # The file that proposes the title of the piece.
    is_primary: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    # The digest of the content, to tell a duplicate from a new file.
    content_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()

    material: Mapped[Material | None] = relationship(back_populates="files")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<MaterialFile {self.file_name}>"


class MaterialSchool(Base):
    """A school that can see a material.

    The pair is the primary key: a school has access to a piece or it
    does not, and it is enabled once.
    """

    __tablename__ = "material_schools"
    __table_args__ = ({"schema": "public"},)

    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.materials.id", ondelete="CASCADE"),
        primary_key=True,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        primary_key=True,
    )
    enabled_at: Mapped[datetime] = created_at()
    enabled_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )

    material: Mapped[Material] = relationship(back_populates="schools")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<MaterialSchool {self.school_id}>"


class MaterialHistory(Base):
    """One entry of the history of a material."""

    __tablename__ = "material_history"
    __table_args__ = ({"schema": "public"},)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    material_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.materials.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    # What changed, as a list of {"field", "before", "after"}.
    detail: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()

    material: Mapped[Material] = relationship(back_populates="history")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<MaterialHistory {self.action}>"


class AuditLog(Base):
    """One critical event of the platform, for support and for the audit."""

    __tablename__ = "audit_log"
    __table_args__ = ({"schema": "public"},)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    level: Mapped[str] = mapped_column(
        String(16),
        nullable=False,
        default="info",
        server_default=text("'info'"),
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    # The name of the actor at the time of the event.
    actor_name: Mapped[str | None] = mapped_column(String(160), nullable=True)
    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="SET NULL"),
        nullable=True,
    )
    subject_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    detail: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default=text("'{}'::jsonb"),
    )
    created_at: Mapped[datetime] = created_at()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<AuditLog {self.event_type}>"


__all__ = [
    "AuditLog",
    "Material",
    "MaterialFile",
    "MaterialHistory",
    "MaterialSchool",
]
