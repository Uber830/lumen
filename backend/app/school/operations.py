"""The queries behind the school administrator's panel.

Everything here is scoped to one school: the caller cannot choose it.
The school comes from the session, through the membership of the
caller, and the queries carry that `school_id` so that a row of
another tenant is never read.

The overview is the exception that proves the rule: it counts the
whole catalog to tell the school how much of it is enabled for them.
That number is published on the public site, so it is not a leak.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import Select, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    AcademicPeriod,
    Course,
    Entitlement,
    Material,
    MaterialCourse,
    MaterialSchool,
    Profile,
    School,
    SchoolMembership,
    StudentEnrollment,
    TaskSubmission,
    TeacherAssignment,
    User,
)

# The state of a material that a school can see. A draft or a review
# one is not part of the enabled material.
PUBLISHED_STATE = "publicado"

# A submission that has been waiting for more than this is old.
STALE_SUBMISSION_DAYS = 3


async def get_school(session: AsyncSession, school_id: uuid.UUID) -> School | None:
    """The school of the caller."""
    result = await session.execute(select(School).where(School.id == school_id))
    return result.scalar_one_or_none()


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """The account of the caller."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_profile(session: AsyncSession, user_id: uuid.UUID) -> Profile | None:
    """The personal data of the caller."""
    result = await session.execute(select(Profile).where(Profile.id == user_id))
    return result.scalar_one_or_none()


async def get_entitlement(session: AsyncSession, school_id: uuid.UUID) -> Entitlement | None:
    """The plan the school is on.

    The plan lives in the subscription, and the entitlements row is the
    cache the rest of the backend reads. The administrator only reads
    it: it is context, not something it manages.
    """
    result = await session.execute(select(Entitlement).where(Entitlement.school_id == school_id))
    return result.scalar_one_or_none()


async def get_current_period(session: AsyncSession, school_id: uuid.UUID) -> AcademicPeriod | None:
    """The period the school is in, if it has one open."""
    result = await session.execute(
        select(AcademicPeriod)
        .where(
            AcademicPeriod.school_id == school_id,
            AcademicPeriod.is_current.is_(True),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# The overview of the school
# ---------------------------------------------------------------------------


async def _count(session: AsyncSession, statement: Select[tuple[int]]) -> int:
    """Run a count query and return the integer."""
    result = await session.execute(statement)
    return int(result.scalar_one())


async def _material_by_area(session: AsyncSession, school_id: uuid.UUID) -> list[tuple[str, int]]:
    """The enabled material of the school, counted by area."""
    result = await session.execute(
        select(Material.area, func.count(Material.id))
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            # The material archived by a closed cycle is history, not the
            # active material of the school.
            MaterialSchool.archived_at.is_(None),
            Material.state == PUBLISHED_STATE,
        )
        .group_by(Material.area)
        .order_by(func.count(Material.id).desc(), Material.area.asc())
    )
    return [(str(area), int(count)) for area, count in result.all()]


async def _member_count(session: AsyncSession, school_id: uuid.UUID, role: str) -> int:
    """How many members of the school hold a role."""
    return await _count(
        session,
        select(func.count(SchoolMembership.id)).where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.role == role,
            SchoolMembership.revoked_at.is_(None),
        ),
    )


async def _teachers_with_access(session: AsyncSession, school_id: uuid.UUID) -> int:
    """How many teachers have at least one assignment.

    The assignment is what gives a teacher access to the material of
    the course: without it, the teacher sees nothing.
    """
    return await _count(
        session,
        select(func.count(distinct(TeacherAssignment.teacher_id))).where(
            TeacherAssignment.school_id == school_id,
        ),
    )


async def _students_with_access(session: AsyncSession, school_id: uuid.UUID) -> int:
    """How many students have an active enrollment."""
    return await _count(
        session,
        select(func.count(distinct(StudentEnrollment.student_id))).where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.status == "active",
        ),
    )


async def _pending_submissions(session: AsyncSession, school_id: uuid.UUID) -> tuple[int, int]:
    """The submissions waiting to be graded, and how many are old."""
    total = await _count(
        session,
        select(func.count(TaskSubmission.id)).where(
            TaskSubmission.school_id == school_id,
            TaskSubmission.status == "submitted",
        ),
    )
    cutoff = datetime.now(UTC) - timedelta(days=STALE_SUBMISSION_DAYS)
    stale = await _count(
        session,
        select(func.count(TaskSubmission.id)).where(
            TaskSubmission.school_id == school_id,
            TaskSubmission.status == "submitted",
            TaskSubmission.submitted_at.is_not(None),
            TaskSubmission.submitted_at < cutoff,
        ),
    )
    return total, stale


async def _activity(session: AsyncSession, school_id: uuid.UUID) -> list[dict[str, Any]]:
    """The recent activity of the school.

    It is not a stored trail: it is built from the rows themselves, so
    it cannot say something that did not happen. Each entry says what
    happened, in what, and when.
    """
    entries: list[dict[str, Any]] = []

    # The last material the platform enabled for this school.
    material_result = await session.execute(
        select(Material, MaterialSchool.enabled_at)
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            Material.state == PUBLISHED_STATE,
        )
        .order_by(MaterialSchool.enabled_at.desc())
        .limit(1)
    )
    material_row = material_result.first()
    if material_row is not None:
        material, enabled_at = material_row
        entries.append(
            {
                "icon": "upload",
                "tone": "success",
                "title": "El equipo editorial cargó material nuevo",
                "detail": f"{material.title} · {material.area}",
                "at": enabled_at,
            }
        )

    # The last course the school opened.
    course_result = await session.execute(
        select(Course.name, Course.created_at)
        .where(Course.school_id == school_id)
        .order_by(Course.created_at.desc())
        .limit(1)
    )
    course_row = course_result.first()
    if course_row is not None:
        name, created_at = course_row
        entries.append(
            {
                "icon": "layers",
                "tone": "info",
                "title": "El colegio abrió un curso",
                "detail": str(name),
                "at": created_at,
            }
        )

    # The students enrolled in the last week.
    week_ago = datetime.now(UTC) - timedelta(days=7)
    enrolled = await _count(
        session,
        select(func.count(StudentEnrollment.id)).where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.enrolled_at >= week_ago,
        ),
    )
    if enrolled:
        entries.append(
            {
                "icon": "users",
                "tone": "muted",
                "title": "Matriculaste estudiantes",
                "detail": f"{enrolled} en los últimos 7 días",
                "at": week_ago,
            }
        )

    # The last assignment between a teacher and a course.
    assignment_result = await session.execute(
        select(TeacherAssignment.assigned_at)
        .where(TeacherAssignment.school_id == school_id)
        .order_by(TeacherAssignment.assigned_at.desc())
        .limit(1)
    )
    assignment_row = assignment_result.first()
    if assignment_row is not None:
        entries.append(
            {
                "icon": "link",
                "tone": "teal",
                "title": "El colegio asignó un docente a un curso",
                "detail": "La asignación habilita el acceso al material",
                "at": assignment_row[0],
            }
        )

    entries.sort(key=lambda entry: entry["at"], reverse=True)
    return entries[:6]


async def get_overview(session: AsyncSession, school_id: uuid.UUID) -> dict[str, Any]:
    """Everything the dashboard of the school shows.

    Every number is counted from the rows of this school. The only
    number that is not school-scoped is the total of the catalog: it
    tells the school how much of the material exists, and it is
    published on the public site.
    """
    material_by_area = await _material_by_area(session, school_id)
    material_available = sum(count for _, count in material_by_area)

    catalog_published = await _count(
        session,
        select(func.count(Material.id)).where(Material.state == PUBLISHED_STATE),
    )

    teachers = await _member_count(session, school_id, "teacher")
    teachers_with_access = await _teachers_with_access(session, school_id)
    students = await _member_count(session, school_id, "student")
    students_with_access = await _students_with_access(session, school_id)
    courses = await _count(
        session,
        select(func.count(Course.id)).where(Course.school_id == school_id),
    )
    pending, stale = await _pending_submissions(session, school_id)

    period = await get_current_period(session, school_id)

    # The last time the platform enabled material for this school.
    last_material_result = await session.execute(
        select(func.max(MaterialSchool.enabled_at)).where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
        )
    )
    last_material_at = last_material_result.scalar_one_or_none()

    return {
        "material": {
            "available": material_available,
            "catalog_total": catalog_published,
            "by_area": [{"area": area, "count": count} for area, count in material_by_area],
            "last_enabled_at": last_material_at,
        },
        "teachers": {
            "total": teachers,
            "with_access": teachers_with_access,
            "pending": max(teachers - teachers_with_access, 0),
        },
        "students": {
            "total": students,
            "with_access": students_with_access,
            "courses": courses,
        },
        "courses": courses,
        "tasks": {"pending": pending, "stale": stale},
        "period": (
            {
                "id": str(period.id),
                "name": period.name,
                "start_date": period.start_date.isoformat(),
                "end_date": period.end_date.isoformat(),
            }
            if period
            else None
        ),
        "activity": await _activity(session, school_id),
    }


# ---------------------------------------------------------------------------
# The material of the school
# ---------------------------------------------------------------------------


async def _material_courses(
    session: AsyncSession,
    school_id: uuid.UUID,
    material_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[tuple[str, str]]]:
    """The courses of the school each material applies to.

    A material with no course applies to the whole school: that is the
    difference between an empty list and the flag that says so.
    """
    if not material_ids:
        return {}

    result = await session.execute(
        select(MaterialCourse.material_id, Course.id, Course.name)
        .join(Course, Course.id == MaterialCourse.course_id)
        .where(
            MaterialCourse.material_id.in_(material_ids),
            Course.school_id == school_id,
        )
        .order_by(Course.name)
    )
    courses: dict[uuid.UUID, list[tuple[str, str]]] = {}
    for material_id, course_id, name in result.all():
        courses.setdefault(material_id, []).append((str(course_id), str(name)))
    return courses


async def _school_creators(
    session: AsyncSession,
    school_id: uuid.UUID,
) -> set[uuid.UUID]:
    """The people of the school.

    A material created by one of them is a resource of the school; the
    rest belong to the editorial team of the platform.
    """
    result = await session.execute(
        select(SchoolMembership.user_id).where(SchoolMembership.school_id == school_id)
    )
    return {row[0] for row in result.all()}


async def list_material(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    query: str | None = None,
    area: str | None = None,
    audience: str | None = None,
    page: int = 1,
    per_page: int = 6,
) -> dict[str, Any]:
    """The material enabled for the school, filtered and paginated.

    The filters run in the database: the catalog of the platform is
    not pulled into the browser to be filtered there.

    Only the material the platform enabled for this school comes back.
    The catalog as a whole is not visible to this role.
    """
    page = max(1, page)
    per_page = max(1, min(per_page, 50))

    filters = [
        MaterialSchool.school_id == school_id,
        MaterialSchool.enabled.is_(True),
        # The material archived by a closed cycle is history, not the
        # active material of the school.
        MaterialSchool.archived_at.is_(None),
        Material.state == PUBLISHED_STATE,
    ]
    if area:
        filters.append(Material.area == area)
    if audience:
        filters.append(Material.visible_to == audience)
    if query:
        pattern = f"%{query.strip().lower()}%"
        filters.append(
            func.lower(Material.title).like(pattern)
            | func.lower(Material.area).like(pattern)
            | func.lower(Material.ref).like(pattern)
            | func.lower(Material.kind).like(pattern)
        )

    total = await _count(
        session,
        select(func.count(Material.id))
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(*filters),
    )

    result = await session.execute(
        select(Material, MaterialSchool.enabled_at)
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(*filters)
        .order_by(MaterialSchool.enabled_at.desc(), Material.title.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    rows = result.all()

    courses = await _material_courses(session, school_id, [row[0].id for row in rows])
    creators = await _school_creators(session, school_id)

    items = [
        {
            "id": str(material.id),
            "ref": material.ref,
            "title": material.title,
            "description": material.description,
            "area": material.area,
            # What the piece is pedagogically: "Libro", "Guía",
            # "Evaluación", "Multimedia" or "Documento".
            "type": material.type,
            "kind": material.kind,
            # Who the piece is for: "all" or "teachers".
            "visible_to": material.visible_to,
            # "lumen" when the editorial team loaded it, "colegio" when
            # it was uploaded by the school itself.
            "origin": (
                "colegio"
                if material.created_by is not None and material.created_by in creators
                else "lumen"
            ),
            "file_size_bytes": material.file_size_bytes,
            "available_since": enabled_at,
            "courses": [
                {"id": course_id, "name": name} for course_id, name in courses.get(material.id, [])
            ],
        }
        for material, enabled_at in rows
    ]

    # The areas that the school can filter by: the ones it has material
    # of. The filter never offers an area with nothing behind it.
    areas_result = await session.execute(
        select(Material.area)
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            MaterialSchool.archived_at.is_(None),
            Material.state == PUBLISHED_STATE,
        )
        .distinct()
        .order_by(Material.area)
    )
    areas = [str(area) for area in areas_result.scalars().all()]

    # How much material the school has, with no filters: the counter of
    # the toolbar talks about the whole library, not about the search.
    available_total = await _count(
        session,
        select(func.count(Material.id))
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            MaterialSchool.archived_at.is_(None),
            Material.state == PUBLISHED_STATE,
        ),
    )

    # The audiences the school can filter by: the ones it has material
    # for. The filter never offers an audience with nothing behind it.
    audiences_result = await session.execute(
        select(Material.visible_to)
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            MaterialSchool.archived_at.is_(None),
            Material.state == PUBLISHED_STATE,
        )
        .distinct()
        .order_by(Material.visible_to)
    )
    audiences = [str(value) for value in audiences_result.scalars().all()]

    return {
        "items": items,
        "total": total,
        "available_total": available_total,
        "page": page,
        "per_page": per_page,
        "pages": (total + per_page - 1) // per_page if total else 0,
        "areas": areas,
        "audiences": audiences,
    }


async def get_material(
    session: AsyncSession,
    school_id: uuid.UUID,
    material_id: uuid.UUID,
) -> dict[str, Any] | None:
    """One material of the school, with its access confirmed.

    A material that is not enabled for this school does not exist for
    it: the answer is None and the endpoint answers 404. A 403 would
    tell the caller that the material of another school is real.
    """
    result = await session.execute(
        select(Material, MaterialSchool.enabled_at)
        .join(MaterialSchool, MaterialSchool.material_id == Material.id)
        .where(
            Material.id == material_id,
            MaterialSchool.school_id == school_id,
            MaterialSchool.enabled.is_(True),
            MaterialSchool.archived_at.is_(None),
            Material.state == PUBLISHED_STATE,
        )
        .limit(1)
    )
    row = result.first()
    if row is None:
        return None

    material, enabled_at = row
    courses = await _material_courses(session, school_id, [material.id])
    creators = await _school_creators(session, school_id)
    return {
        "id": str(material.id),
        "ref": material.ref,
        "title": material.title,
        "description": material.description,
        "area": material.area,
        "type": material.type,
        "kind": material.kind,
        "visible_to": material.visible_to,
        "origin": (
            "colegio"
            if material.created_by is not None and material.created_by in creators
            else "lumen"
        ),
        "file_size_bytes": material.file_size_bytes,
        "available_since": enabled_at,
        "courses": [
            {"id": course_id, "name": name} for course_id, name in courses.get(material.id, [])
        ],
        "access": {
            "confirmed": True,
            "enabled_at": enabled_at,
            "note": "Este material está habilitado para tu colegio.",
        },
    }


__all__ = [
    "get_current_period",
    "get_material",
    "get_entitlement",
    "get_overview",
    "get_profile",
    "get_school",
    "get_user",
    "list_material",
]
