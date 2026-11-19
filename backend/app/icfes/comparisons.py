"""ICFES comparisons endpoint.

GET /v1/icfes/comparisons returns a per-simulation aggregate for the
calling teacher's assigned course_subjects, optionally filtered by
simulation_id. School admin sees all simulations in their school.

The response shape matches what the previous aggregate-results.tsx
rendered: per simulation, the average global_score across graded
attempts, the student count, and the per-area averages.

Phase 2: the school and the role come from the request context, so
the caller cannot ask about a school they do not belong to.
"""

from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.db.enums import IcfesAttemptStatus, SchoolRole
from app.db.models import (
    IcfesAttempt,
    IcfesScore,
    IcfesSimulation,
    TeacherAssignment,
)
from app.db.session import get_db
from app.deps import get_context

router = APIRouter(prefix="/v1/icfes", tags=["icfes"])


async def _assigned_course_subject_ids(
    session: AsyncSession,
    school_id: UUID,
    user_id: UUID,
) -> set[UUID]:
    """Return the course_subject_ids the teacher is assigned to."""
    result = await session.execute(
        select(TeacherAssignment.course_subject_id).where(
            TeacherAssignment.school_id == school_id,
            TeacherAssignment.teacher_id == user_id,
        )
    )
    return set(result.scalars().all())


@router.get("/comparisons")
async def list_comparisons(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    simulation_id: Annotated[UUID | None, Query()] = None,
    grado: Annotated[str | None, Query()] = None,
) -> dict[str, Any]:
    """Per-simulation aggregates scoped by the caller's role."""
    membership = context.require_any_membership()
    school_id = membership.school_id
    role = membership.role

    # Build the base query: published simulations in the school.
    sim_query = select(IcfesSimulation).where(
        IcfesSimulation.school_id == school_id,
        IcfesSimulation.is_published.is_(True),
    )
    if simulation_id is not None:
        sim_query = sim_query.where(IcfesSimulation.id == simulation_id)
    sim_query = sim_query.order_by(IcfesSimulation.available_until.asc())

    # A teacher only sees the simulations of the course subjects they
    # are assigned to.
    if role == SchoolRole.TEACHER:
        allowed = await _assigned_course_subject_ids(session, school_id, context.user_id)
        if not allowed:
            return {"comparisons": []}
        sim_query = sim_query.where(IcfesSimulation.course_subject_id.in_(allowed))

    sim_result = await session.execute(sim_query)
    simulations = list(sim_result.scalars().all())

    if not simulations:
        return {"comparisons": []}

    simulation_ids = [sim.id for sim in simulations]

    # Aggregate the graded attempts per simulation in one query.
    attempt_agg = await session.execute(
        select(
            IcfesAttempt.simulation_id,
            func.count(IcfesAttempt.id).label("student_count"),
            func.avg(IcfesAttempt.global_score).label("avg_global"),
            func.avg(IcfesAttempt.max_score).label("avg_max"),
            func.avg(IcfesAttempt.percent).label("avg_percent"),
        )
        .where(
            IcfesAttempt.simulation_id.in_(simulation_ids),
            IcfesAttempt.status == IcfesAttemptStatus.GRADED,
        )
        .group_by(IcfesAttempt.simulation_id)
    )
    aggregates = {row.simulation_id: row for row in attempt_agg.all()}

    # Aggregate the per-area scores per simulation in one query.
    area_agg = await session.execute(
        select(
            IcfesAttempt.simulation_id,
            IcfesScore.area,
            func.avg(IcfesScore.correct).label("avg_correct"),
            func.avg(IcfesScore.total).label("avg_total"),
            func.avg(IcfesScore.percent).label("avg_percent"),
        )
        .join(IcfesAttempt, IcfesAttempt.id == IcfesScore.attempt_id)
        .where(
            IcfesAttempt.simulation_id.in_(simulation_ids),
            IcfesAttempt.status == IcfesAttemptStatus.GRADED,
        )
        .group_by(IcfesAttempt.simulation_id, IcfesScore.area)
    )
    areas_by_simulation: dict[UUID, list[dict[str, object]]] = {}
    for row in area_agg.all():
        areas_by_simulation.setdefault(row.simulation_id, []).append(
            {
                "area": row.area,
                "correct": float(row.avg_correct or 0),
                "total": float(row.avg_total or 0),
                "percent": float(row.avg_percent or 0),
            }
        )

    out: list[dict[str, Any]] = []
    for sim in simulations:
        aggregate = aggregates.get(sim.id)
        out.append(
            {
                "simulation_id": str(sim.id),
                "title": sim.title,
                "course_subject_id": str(sim.course_subject_id),
                "available_from": sim.available_from,
                "available_until": sim.available_until,
                "student_count": int(aggregate.student_count) if aggregate else 0,
                "avg_global": float(aggregate.avg_global or 0) if aggregate else 0.0,
                "avg_max": float(aggregate.avg_max or 0) if aggregate else 0.0,
                "avg_percent": float(aggregate.avg_percent or 0) if aggregate else 0.0,
                "by_area": areas_by_simulation.get(sim.id, []),
            }
        )

    return {"comparisons": out}
