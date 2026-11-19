"""The editorial catalog, as the platform team works with it.

This module owns the rules of the module:

- the closed catalogs (types, areas, grades) the frontend must not
  hardcode;
- the lifecycle of a material and the transitions that are valid;
- what a material needs to be published;
- the queries that read the catalog, the coverage of the schools and
  the audit trail.

The endpoints in `app.platform.router` only translate HTTP into these
calls: the rules live here so that they can be tested without a
request.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import ColumnElement, Integer, cast, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.enums import SchoolRole, SchoolStatus
from app.db.models import (
    AuditLog,
    Entitlement,
    Material,
    MaterialFile,
    MaterialHistory,
    MaterialSchool,
    School,
    SchoolMembership,
)

# ---------------------------------------------------------------------------
# The closed catalogs
#
# They are served by `GET /v1/platform/catalog-options`, so the frontend
# never carries them as constants.
# ---------------------------------------------------------------------------

MATERIAL_TYPES: tuple[str, ...] = (
    "Libro",
    "Guía",
    "Evaluación",
    "Multimedia",
    "Documento",
)

MATERIAL_AREAS: tuple[str, ...] = (
    "Matemáticas",
    "Lenguaje",
    "Ciencias",
    "Sociales",
    "Inglés",
    "Convivencia",
    "Orientación",
    "ICFES",
    "Artes",
    "Deportes",
)

MATERIAL_GRADES: tuple[str, ...] = ("6°", "7°", "8°", "9°", "10°", "11°")

MATERIAL_STATUSES: tuple[str, ...] = ("draft", "review", "published", "archived")

VISIBLE_TO: tuple[str, ...] = ("all", "teachers")

# The first code of the catalog. The numbers keep growing.
FIRST_CODE_NUMBER = 1041

# How many rows the catalog listing shows by default.
DEFAULT_PER_PAGE = 8

# The largest page the API serves.
MAX_PER_PAGE = 50

# How many school names a row of the listing shows before counting the
# rest.
SCHOOLS_VISIBLE = 2


# ---------------------------------------------------------------------------
# The lifecycle
# ---------------------------------------------------------------------------

# The transitions that are valid from each state. The backend decides
# them: the frontend shows what this returns instead of guessing.
TRANSITIONS: dict[str, tuple[str, ...]] = {
    "draft": ("review", "published"),
    "review": ("draft", "published"),
    "published": ("archived",),
    "archived": ("published",),
}


def available_transitions(status: str) -> list[str]:
    """The states a material in this state can move to."""
    return list(TRANSITIONS.get(status, ()))


def can_transition(current: str, target: str) -> bool:
    """Whether a material can move from one state to another."""
    return target in TRANSITIONS.get(current, ())


# ---------------------------------------------------------------------------
# The formatting
# ---------------------------------------------------------------------------


def format_size(size_bytes: int) -> str:
    """The size of a material, as it is shown.

    Colombian format: a comma for the decimals and a dot for the
    thousands.
    """
    if size_bytes <= 0:
        return "0 B"

    units = ("B", "KB", "MB", "GB", "TB")
    value = float(size_bytes)
    unit = units[0]
    for unit in units:
        if value < 1024 or unit == units[-1]:
            break
        value /= 1024

    if unit == "B":
        return f"{int(value)} B"
    return f"{_decimal(value)} {unit}"


def _decimal(value: float) -> str:
    """A number with a comma for the decimals and a dot for the thousands."""
    whole, _, fraction = f"{value:,.1f}".partition(".")
    return f"{whole.replace(',', '.')},{fraction}"


async def next_code(session: AsyncSession) -> str:
    """The code of the next material: "C-1041".

    The number is the highest one in use plus one. The code is unique,
    so a race that takes the same number is rejected by the database
    and the caller can try again.
    """
    result = await session.execute(
        select(func.max(cast(func.substring(Material.code, 3), Integer)))
    )
    highest = result.scalar_one_or_none()
    number = FIRST_CODE_NUMBER if highest is None else int(highest) + 1
    return f"C-{number}"


# ---------------------------------------------------------------------------
# The publication rules
# ---------------------------------------------------------------------------


def publication_gaps(material: Material, school_count: int) -> list[str]:
    """What a material still needs to be published.

    An empty list means it can go to "published". The names are the ones
    the frontend shows as the reason why the button is blocked.
    """
    gaps: list[str] = []
    if not material.title.strip():
        gaps.append("title")
    if not material.type.strip():
        gaps.append("type")
    if not material.area.strip():
        gaps.append("area")
    if not material.grades:
        gaps.append("grades")
    if school_count == 0:
        gaps.append("schools")
    return gaps


# ---------------------------------------------------------------------------
# The history and the audit trail
# ---------------------------------------------------------------------------


async def record_history(
    session: AsyncSession,
    *,
    material: Material,
    action: str,
    actor_id: uuid.UUID | None,
    detail: dict[str, Any] | None = None,
) -> MaterialHistory:
    """Write one entry in the history of a material."""
    entry = MaterialHistory(
        material_id=material.id,
        action=action,
        detail=detail or {},
        actor_id=actor_id,
    )
    session.add(entry)
    return entry


async def record_audit(
    session: AsyncSession,
    *,
    event_type: str,
    actor_id: uuid.UUID | None,
    actor_name: str | None,
    subject_type: str | None = None,
    subject_id: uuid.UUID | None = None,
    school_id: uuid.UUID | None = None,
    level: str = "info",
    detail: dict[str, Any] | None = None,
) -> AuditLog:
    """Write one event in the audit trail."""
    entry = AuditLog(
        event_type=event_type,
        level=level,
        actor_id=actor_id,
        actor_name=actor_name,
        subject_type=subject_type,
        subject_id=subject_id,
        school_id=school_id,
        detail=detail or {},
    )
    session.add(entry)
    return entry


# ---------------------------------------------------------------------------
# Reading the catalog
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class MaterialRow:
    """One material of the listing."""

    material: Material
    school_ids: list[uuid.UUID]
    school_names: list[str]
    size_bytes: int

    @property
    def size_label(self) -> str:
        return format_size(self.size_bytes)


async def _load_schools(
    session: AsyncSession,
    material_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[tuple[uuid.UUID, str]]]:
    """The schools with access to each material, in the order they were enabled."""
    if not material_ids:
        return {}

    result = await session.execute(
        select(MaterialSchool.material_id, MaterialSchool.school_id, School.name)
        .join(School, School.id == MaterialSchool.school_id)
        .where(MaterialSchool.material_id.in_(material_ids))
        .order_by(MaterialSchool.enabled_at, School.name)
    )

    grouped: dict[uuid.UUID, list[tuple[uuid.UUID, str]]] = {}
    for material_id, school_id, name in result.all():
        grouped.setdefault(material_id, []).append((school_id, name))
    return grouped


async def list_materials(
    session: AsyncSession,
    *,
    query: str | None = None,
    material_type: str | None = None,
    status: str | None = None,
    school_id: uuid.UUID | None = None,
    page: int = 1,
    per_page: int = DEFAULT_PER_PAGE,
) -> tuple[list[MaterialRow], int]:
    """The materials of the catalog, filtered and paginated.

    The filters are applied in the database: the listing asks for one
    page, not for everything and then cuts it.
    """
    conditions: list[ColumnElement[bool]] = []
    if query:
        pattern = f"%{query.strip()}%"
        conditions.append(Material.title.ilike(pattern) | Material.code.ilike(pattern))
    if material_type:
        conditions.append(Material.type == material_type)
    if status:
        conditions.append(Material.status == status)
    if school_id:
        conditions.append(
            Material.id.in_(
                select(MaterialSchool.material_id).where(MaterialSchool.school_id == school_id)
            )
        )

    total = await session.execute(select(func.count()).select_from(Material).where(*conditions))
    count = int(total.scalar_one())

    result = await session.execute(
        select(Material)
        .options(selectinload(Material.files))
        .where(*conditions)
        .order_by(Material.updated_at.desc(), Material.code)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    materials = list(result.scalars().all())

    schools = await _load_schools(session, [material.id for material in materials])

    rows: list[MaterialRow] = []
    for material in materials:
        pairs = schools.get(material.id, [])
        rows.append(
            MaterialRow(
                material=material,
                school_ids=[school_id for school_id, _ in pairs],
                school_names=[name for _, name in pairs],
                size_bytes=sum(file.size_bytes for file in material.files),
            )
        )
    return rows, count


async def get_material(
    session: AsyncSession,
    material_id: uuid.UUID,
) -> Material | None:
    """One material with its files, its access and its history."""
    result = await session.execute(
        select(Material)
        .options(
            selectinload(Material.files),
            selectinload(Material.schools),
            selectinload(Material.history),
        )
        .where(Material.id == material_id)
        # The material is read again after every change: the session
        # may still hold the copy it loaded before.
        .execution_options(populate_existing=True)
    )
    return result.scalars().first()


async def get_material_by_code(session: AsyncSession, code: str) -> Material | None:
    """One material, looked up by its code."""
    result = await session.execute(select(Material).where(Material.code == code))
    return result.scalars().first()


# ---------------------------------------------------------------------------
# The network
# ---------------------------------------------------------------------------


async def count_memberships(
    session: AsyncSession,
    *,
    role: SchoolRole,
) -> int:
    """How many teachers or students the network has."""
    result = await session.execute(
        select(func.count())
        .select_from(SchoolMembership)
        .where(
            SchoolMembership.role == role,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    return int(result.scalar_one())


async def count_students_of_school(session: AsyncSession, school_id: uuid.UUID) -> int:
    """How many students a school has."""
    result = await session.execute(
        select(func.count())
        .select_from(SchoolMembership)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == SchoolRole.STUDENT,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    return int(result.scalar_one())


async def count_teachers_of_school(session: AsyncSession, school_id: uuid.UUID) -> int:
    """How many teachers a school has."""
    result = await session.execute(
        select(func.count())
        .select_from(SchoolMembership)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == SchoolRole.TEACHER,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    return int(result.scalar_one())


async def plan_of_school(session: AsyncSession, school_id: uuid.UUID) -> str | None:
    """The plan a school is on."""
    result = await session.execute(
        select(Entitlement.plan_name).where(Entitlement.school_id == school_id)
    )
    return result.scalar_one_or_none()


async def covered_materials(session: AsyncSession, school_id: uuid.UUID) -> int:
    """How many materials a school can see."""
    result = await session.execute(
        select(func.count())
        .select_from(MaterialSchool)
        .where(MaterialSchool.school_id == school_id)
    )
    return int(result.scalar_one())


async def total_materials(session: AsyncSession) -> int:
    """How many materials the catalog holds."""
    result = await session.execute(select(func.count()).select_from(Material))
    return int(result.scalar_one())


async def metrics(session: AsyncSession) -> dict[str, Any]:
    """The figures of the global panel.

    Every number comes from the database: the panel does not carry
    figures of its own.
    """
    schools_result = await session.execute(
        select(func.count()).select_from(School).where(School.status != SchoolStatus.SUSPENDED)
    )
    schools = int(schools_result.scalar_one())

    materials_result = await session.execute(select(func.count()).select_from(Material))
    materials = int(materials_result.scalar_one())

    status_rows = await session.execute(
        select(Material.status, func.count()).group_by(Material.status)
    )
    by_status = {status: 0 for status in MATERIAL_STATUSES}
    by_status.update({status: int(count) for status, count in status_rows.all()})

    area_rows = await session.execute(select(Material.area, func.count()).group_by(Material.area))
    by_area = {area: int(count) for area, count in area_rows.all()}

    coverage = await school_coverage(session, total=materials)

    return {
        "schools": schools,
        "teachers": await count_memberships(session, role=SchoolRole.TEACHER),
        "students": await count_memberships(session, role=SchoolRole.STUDENT),
        "materials": materials,
        "materials_by_status": by_status,
        "materials_by_area": by_area,
        "school_coverage": coverage,
    }


async def school_figures(
    session: AsyncSession,
    school_ids: list[uuid.UUID],
) -> dict[uuid.UUID, dict[str, Any]]:
    """The figures of a group of schools: plan, students, teachers and coverage.

    They are counted in four queries for the whole group, not one per
    school: the panel lists every school of the network.
    """
    if not school_ids:
        return {}

    figures: dict[uuid.UUID, dict[str, Any]] = {
        school_id: {
            "plan": None,
            "students": 0,
            "teachers": 0,
            "covered": 0,
        }
        for school_id in school_ids
    }

    plan_rows = await session.execute(
        select(Entitlement.school_id, Entitlement.plan_name).where(
            Entitlement.school_id.in_(school_ids)
        )
    )
    for school_id, plan_name in plan_rows.all():
        figures[school_id]["plan"] = plan_name

    membership_rows = await session.execute(
        select(SchoolMembership.school_id, SchoolMembership.role, func.count())
        .where(
            SchoolMembership.school_id.in_(school_ids),
            SchoolMembership.revoked_at.is_(None),
            SchoolMembership.role.in_((SchoolRole.TEACHER, SchoolRole.STUDENT)),
        )
        .group_by(SchoolMembership.school_id, SchoolMembership.role)
    )
    for school_id, role, count in membership_rows.all():
        key = "students" if role == SchoolRole.STUDENT else "teachers"
        figures[school_id][key] = int(count)

    # Only the published pieces are visible to a school: a draft or a
    # piece in review does not count as coverage.
    coverage_rows = await session.execute(
        select(MaterialSchool.school_id, func.count())
        .join(Material, Material.id == MaterialSchool.material_id)
        .where(
            MaterialSchool.school_id.in_(school_ids),
            Material.status == "published",
        )
        .group_by(MaterialSchool.school_id)
    )
    for school_id, count in coverage_rows.all():
        figures[school_id]["covered"] = int(count)

    return figures


async def school_coverage(
    session: AsyncSession, *, total: int | None = None
) -> list[dict[str, Any]]:
    """How much of the catalog each school can see."""
    if total is None:
        total = await total_materials(session)

    schools_result = await session.execute(select(School).order_by(School.name))
    schools = list(schools_result.scalars().all())

    figures = await school_figures(session, [school.id for school in schools])

    coverage: list[dict[str, Any]] = []
    for school in schools:
        school_figures_row = figures.get(school.id, {})
        coverage.append(
            {
                "school_id": school.id,
                "name": school.name,
                "short_code": school.short_code,
                "status": school.status,
                "plan": school_figures_row.get("plan"),
                "students": school_figures_row.get("students", 0),
                "teachers": school_figures_row.get("teachers", 0),
                "covered": school_figures_row.get("covered", 0),
                "total": total,
            }
        )
    return coverage


async def list_schools(
    session: AsyncSession,
    *,
    query: str | None = None,
    plan: str | None = None,
    status: str | None = None,
    page: int = 1,
    per_page: int = DEFAULT_PER_PAGE,
) -> tuple[list[dict[str, Any]], int]:
    """The schools of the network, filtered and paginated."""
    conditions: list[ColumnElement[bool]] = []
    if query:
        pattern = f"%{query.strip()}%"
        conditions.append(School.name.ilike(pattern) | School.short_code.ilike(pattern))
    if status:
        conditions.append(School.status == status)
    if plan:
        conditions.append(
            School.id.in_(select(Entitlement.school_id).where(Entitlement.plan_code == plan))
        )

    total = await session.execute(select(func.count()).select_from(School).where(*conditions))
    count = int(total.scalar_one())

    result = await session.execute(
        select(School)
        .where(*conditions)
        .order_by(School.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    schools = list(result.scalars().all())

    figures = await school_figures(session, [school.id for school in schools])
    materials_total = await total_materials(session)

    rows: list[dict[str, Any]] = []
    for school in schools:
        school_figures_row = figures.get(school.id, {})
        rows.append(
            {
                "id": school.id,
                "name": school.name,
                "short_code": school.short_code,
                "status": school.status,
                "plan": school_figures_row.get("plan"),
                "students": school_figures_row.get("students", 0),
                "teachers": school_figures_row.get("teachers", 0),
                "covered": school_figures_row.get("covered", 0),
                "total": materials_total,
            }
        )
    return rows, count


# ---------------------------------------------------------------------------
# The audit trail
# ---------------------------------------------------------------------------


async def list_audit(
    session: AsyncSession,
    *,
    level: str | None = None,
    school_id: uuid.UUID | None = None,
    event_type: str | None = None,
    page: int = 1,
    per_page: int = DEFAULT_PER_PAGE,
) -> tuple[list[AuditLog], int]:
    """The audit trail, filtered and paginated."""
    conditions: list[ColumnElement[bool]] = []
    if level:
        conditions.append(AuditLog.level == level)
    if school_id:
        conditions.append(AuditLog.school_id == school_id)
    if event_type:
        conditions.append(AuditLog.event_type == event_type)

    total = await session.execute(select(func.count()).select_from(AuditLog).where(*conditions))
    count = int(total.scalar_one())

    result = await session.execute(
        select(AuditLog)
        .where(*conditions)
        .order_by(AuditLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    return list(result.scalars().all()), count


# ---------------------------------------------------------------------------
# The uploads
# ---------------------------------------------------------------------------

# The formats the catalog admits in this version, and the limit of each
# one. The key of the map is the mime type.
ALLOWED_MIME_TYPES: dict[str, int] = {
    "application/pdf": 200 * 1024 * 1024,
    "application/epub+zip": 200 * 1024 * 1024,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": 100 * 1024 * 1024,
    "application/zip": 500 * 1024 * 1024,
    "video/mp4": 1024 * 1024 * 1024,
}

# The extensions that map to a mime type when the browser sends none.
EXTENSION_MIME_TYPES: dict[str, str] = {
    ".pdf": "application/pdf",
    ".epub": "application/epub+zip",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".zip": "application/zip",
    ".mp4": "video/mp4",
}


def mime_type_of(file_name: str, declared: str | None) -> str | None:
    """The mime type of an uploaded file.

    The browser sends it most of the time; when it does not, the
    extension is the fallback.
    """
    if declared and declared in ALLOWED_MIME_TYPES:
        return declared
    lowered = file_name.lower()
    for extension, mime in EXTENSION_MIME_TYPES.items():
        if lowered.endswith(extension):
            return mime
    return declared or None


def size_limit_for(mime_type: str) -> int:
    """The size limit of a format, in bytes."""
    return ALLOWED_MIME_TYPES.get(mime_type, 100 * 1024 * 1024)


async def find_duplicate(
    session: AsyncSession,
    content_hash: str,
) -> MaterialFile | None:
    """The file with the same content, when there is one.

    A file that is already in the catalog is not uploaded again: the
    platform team is told which material it belongs to.
    """
    result = await session.execute(
        select(MaterialFile).where(MaterialFile.content_hash == content_hash)
    )
    return result.scalars().first()


async def materialize_upload(
    session: AsyncSession,
    *,
    file: MaterialFile,
    material_id: uuid.UUID,
) -> None:
    """Attach an uploaded file to a material."""
    file.material_id = material_id


def now_utc() -> datetime:
    """The current time, in UTC."""
    return datetime.now(UTC)


__all__ = [
    "ALLOWED_MIME_TYPES",
    "DEFAULT_PER_PAGE",
    "EXTENSION_MIME_TYPES",
    "FIRST_CODE_NUMBER",
    "MATERIAL_AREAS",
    "MATERIAL_GRADES",
    "MATERIAL_STATUSES",
    "MATERIAL_TYPES",
    "MAX_PER_PAGE",
    "SCHOOLS_VISIBLE",
    "TRANSITIONS",
    "VISIBLE_TO",
    "MaterialRow",
    "available_transitions",
    "can_transition",
    "covered_materials",
    "count_memberships",
    "count_students_of_school",
    "count_teachers_of_school",
    "find_duplicate",
    "format_size",
    "get_material",
    "get_material_by_code",
    "list_audit",
    "list_materials",
    "materialize_upload",
    "metrics",
    "mime_type_of",
    "next_code",
    "now_utc",
    "plan_of_school",
    "publication_gaps",
    "record_audit",
    "record_history",
    "school_coverage",
    "size_limit_for",
    "total_materials",
]
