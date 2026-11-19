"""The models of the public site.

- `site_content` holds the editable copy of the landing.
- `catalog_items` is the editorial catalog the platform team publishes.
- `catalog_item_schools` says who has access to each piece.

The schools are stored as published names, not as references to the
tenant table: showing a client name on the public site is an explicit
decision of the platform team, never a side effect.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, created_at, updated_at


class SiteContent(Base):
    """One page of editable content.

    The copy is stored as JSON: the API validates it against its
    schema before serving it, so a malformed edit fails loudly at the
    API instead of quietly reaching the page.
    """

    __tablename__ = "site_content"
    __table_args__ = ({"schema": "public"},)

    key: Mapped[str] = mapped_column(Text, primary_key=True)
    content: Mapped[dict[str, object]] = mapped_column(
        JSONB,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<SiteContent {self.key}>"


class CatalogItem(Base):
    """A piece of material in the editorial catalog."""

    __tablename__ = "catalog_items"
    __table_args__ = (
        UniqueConstraint("ref", name="catalog_items_ref_uq"),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    ref: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    # The size and the audience of the piece, shown under the title.
    meta: Mapped[str | None] = mapped_column(Text, nullable=True)
    area: Mapped[str] = mapped_column(Text, nullable=False)
    state: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()

    schools: Mapped[list[CatalogItemSchool]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        order_by="CatalogItemSchool.position",
    )

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<CatalogItem {self.ref}>"


class CatalogItemSchool(Base):
    """A school with access to a catalog item, as it is published."""

    __tablename__ = "catalog_item_schools"
    __table_args__ = ({"schema": "public"},)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    catalog_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.catalog_items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    school_name: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    item: Mapped[CatalogItem] = relationship(back_populates="schools")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<CatalogItemSchool {self.school_name}>"


__all__ = ["CatalogItem", "CatalogItemSchool", "SiteContent"]
