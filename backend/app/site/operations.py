"""Reading the public site content.

The landing is served from the database: the platform team edits the
copy and the catalog there, and the page follows without a redeploy.
"""

from __future__ import annotations

from typing import cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ServiceUnavailableError
from app.db.models import CatalogItem, SiteContent
from app.site.schemas import (
    CatalogEntry,
    CatalogState,
    SiteCopy,
    SiteDocument,
    SiteResponse,
    StatItem,
)

# The key of the landing in `site_content`.
LANDING_KEY = "landing"

# How many rows of the catalog the page shows.
CATALOG_PAGE_SIZE = 6

# How many school names a row shows before counting the rest.
SCHOOLS_VISIBLE = 2


async def get_document(session: AsyncSession, key: str = LANDING_KEY) -> SiteDocument:
    """Read and validate the content of a page.

    A document that does not fit the contract is an error, not a
    half-rendered page: the platform team has to know that the edit
    they made did not work.
    """
    row = await session.get(SiteContent, key)
    if row is None:
        raise ServiceUnavailableError("El contenido del sitio no esta disponible.")

    try:
        return SiteDocument.model_validate(row.content)
    except ValueError as exc:
        raise ServiceUnavailableError(
            f"El contenido del sitio '{key}' no cumple el formato esperado."
        ) from exc


async def list_catalog(session: AsyncSession, limit: int = CATALOG_PAGE_SIZE) -> list[CatalogItem]:
    """The first rows of the catalog, with their schools."""
    result = await session.execute(
        select(CatalogItem)
        .options(selectinload(CatalogItem.schools))
        .order_by(CatalogItem.position, CatalogItem.ref)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_catalog(session: AsyncSession) -> int:
    """How many pieces the catalog holds."""
    result = await session.execute(select(func.count()).select_from(CatalogItem))
    return int(result.scalar_one())


def to_entries(items: list[CatalogItem]) -> list[CatalogEntry]:
    """Turn the catalog rows into the shape the page shows."""
    entries: list[CatalogEntry] = []
    for item in items:
        names = [school.school_name for school in item.schools]
        visible = names[:SCHOOLS_VISIBLE]
        entries.append(
            CatalogEntry(
                ref=item.ref,
                title=item.title,
                meta=item.meta,
                area=item.area,
                schools=visible,
                schools_extra=max(0, len(names) - len(visible)),
                state=cast(CatalogState, item.state),
            )
        )
    return entries


async def build_site_response(session: AsyncSession) -> SiteResponse:
    """Assemble the whole payload of the public site."""
    document = await get_document(session)
    items = await list_catalog(session)
    total = await count_catalog(session)

    copy = SiteCopy.model_validate(
        document.model_dump(exclude={"stats", "contact_email"}),
    )

    return SiteResponse(
        stats=[StatItem.model_validate(stat) for stat in document.stats],
        catalog=to_entries(items),
        catalog_total=total,
        contact_email=document.contact_email,
        content=copy,
    )


__all__ = [
    "CATALOG_PAGE_SIZE",
    "LANDING_KEY",
    "SCHOOLS_VISIBLE",
    "build_site_response",
    "count_catalog",
    "get_document",
    "list_catalog",
    "to_entries",
]
