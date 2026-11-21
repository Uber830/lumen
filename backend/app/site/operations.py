"""Reading the public site content.

The landing is served from the database: the platform team edits the
copy there, and the page follows without a redeploy.

The catalog it shows is the editorial catalog of the platform role
(`materials` and the schools that have access to each piece), so the
public site and the panel of the platform team read the same source.
"""

from __future__ import annotations

import uuid
from typing import cast

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import ServiceUnavailableError
from app.db.models import Material, MaterialSchool, School, SiteContent
from app.platform.catalog import format_size, status_of
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


async def list_catalog(session: AsyncSession, limit: int = CATALOG_PAGE_SIZE) -> list[Material]:
    """The first rows of the catalog, in the editorial order."""
    result = await session.execute(
        select(Material)
        .options(selectinload(Material.files))
        .order_by(Material.position, Material.ref)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_catalog(session: AsyncSession) -> int:
    """How many pieces the catalog holds."""
    result = await session.execute(select(func.count()).select_from(Material))
    return int(result.scalar_one())


async def school_names_of(
    session: AsyncSession,
    material_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[str]]:
    """The names of the schools that have access to each piece."""
    if not material_ids:
        return {}

    result = await session.execute(
        select(MaterialSchool.material_id, School.name)
        .join(School, School.id == MaterialSchool.school_id)
        .where(
            MaterialSchool.material_id.in_(material_ids),
            # A school that lost the access keeps the row, but it is
            # not one of the schools that see the piece.
            MaterialSchool.enabled.is_(True),
        )
        .order_by(MaterialSchool.enabled_at, School.name)
    )

    grouped: dict[uuid.UUID, list[str]] = {}
    for material_id, name in result.all():
        grouped.setdefault(material_id, []).append(name)
    return grouped


def to_entries(
    items: list[Material],
    schools: dict[uuid.UUID, list[str]],
) -> list[CatalogEntry]:
    """Turn the catalog rows into the shape the page shows."""
    entries: list[CatalogEntry] = []
    for item in items:
        names = schools.get(item.id, [])
        visible = names[:SCHOOLS_VISIBLE]
        entries.append(
            CatalogEntry(
                ref=item.ref,
                title=item.title,
                meta=_meta_of(item),
                area=item.area,
                schools=visible,
                schools_extra=max(0, len(names) - len(visible)),
                state=cast(CatalogState, status_of(item.state)),
            )
        )
    return entries


def _meta_of(item: Material) -> str | None:
    """The line under the title: the size and the grades."""
    size = format_size(sum(file.size_bytes for file in item.files))
    grades = ", ".join(item.grades)
    if grades:
        return f"{size} · {grades}"
    return size


async def build_site_response(session: AsyncSession) -> SiteResponse:
    """Assemble the whole payload of the public site."""
    document = await get_document(session)
    items = await list_catalog(session)
    total = await count_catalog(session)
    schools = await school_names_of(session, [item.id for item in items])

    copy = SiteCopy.model_validate(
        document.model_dump(exclude={"stats", "contact_email"}),
    )

    return SiteResponse(
        stats=[StatItem.model_validate(stat) for stat in document.stats],
        catalog=to_entries(items, schools),
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
    "school_names_of",
    "to_entries",
]
