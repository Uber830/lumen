"""The model of the public site.

`site_content` holds the editable copy of the landing. The editorial
catalog it showed moved to its own model in
`app.db.models.catalog`, because a catalog piece carries files, access
and history, not a title and a line of text.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

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


__all__ = ["SiteContent"]
