"""The editorial catalog: the material the platform team publishes.

The model of the product is one-directional:

- the school delivers its information;
- the **platform team** uploads the material to the catalog and
  decides which school sees each piece;
- the school only consumes it.

So these tables are written by the platform team and read by the
schools. A school administrator never writes here: the "Contenido"
view only reads what is enabled for its school.

- `materials`         the pieces of material, with their file.
- `material_schools`  the schools each piece is enabled for.
- `material_courses`  the courses each piece applies to. A piece with
                       no course applies to the whole school.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at, updated_at


class Material(Base):
    """A piece of the editorial catalog.

    `state` says where the piece is: a draft is not visible to anyone,
    a published one is visible to the schools it is enabled for.
    """

    __tablename__ = "materials"
    __table_args__ = (
        UniqueConstraint("ref", name="materials_ref_uq"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # The short code shown in the tables: C-1041.
    ref: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    area: Mapped[str] = mapped_column(Text, nullable=False)
    # pdf, docx, epub, mp4 or zip.
    kind: Mapped[str] = mapped_column(Text, nullable=False)
    # Where the file lives in the storage bucket.
    storage_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # borrador, en_revision, publicado or archivado.
    state: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="borrador",
        server_default="borrador",
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    schools: Mapped[list[MaterialSchool]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
    )
    courses: Mapped[list[MaterialCourse]] = relationship(
        back_populates="material",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<Material {self.ref}>"


class MaterialSchool(Base):
    """A school with access to a piece of material."""

    __tablename__ = "material_schools"
    __table_args__ = (
        UniqueConstraint(
            "material_id",
            "school_id",
            name="material_schools_material_school_uq",
        ),
        {"schema": "public"},
    )

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
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    enabled: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    enabled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    # When the material left the active material of the school: the
    # cycle it belonged to was closed. The row stays as history.
    archived_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    material: Mapped[Material] = relationship(back_populates="schools")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<MaterialSchool material={self.material_id} school={self.school_id}>"


class MaterialCourse(Base):
    """A course a piece of material applies to.

    A material with no row here applies to the whole school.
    """

    __tablename__ = "material_courses"
    __table_args__ = (
        UniqueConstraint(
            "material_id",
            "course_id",
            name="material_courses_material_course_uq",
        ),
        {"schema": "public"},
    )

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
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    material: Mapped[Material] = relationship(back_populates="courses")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<MaterialCourse material={self.material_id} course={self.course_id}>"


__all__ = ["Material", "MaterialCourse", "MaterialSchool"]
