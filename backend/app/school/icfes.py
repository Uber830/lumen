"""The simulators of the college: the platform team enables them, the
school activates them.

The catalog of simulators lives in three layers and each one has a
single owner:

- `icfes_simulators` is written by the platform team.
- `icfes_simulator_schools` says which school has each simulator. The
  platform team enables it; the school cannot.
- `icfes_activations` says what the school does with what it received:
  in which courses the simulator runs and until when.

So the school sees only what the platform enabled, and it only decides
the courses and the deadline. It never uploads, publishes or enables a
simulator: there is no endpoint for that here.

The results come from the attempts of the exam the simulator points to,
counted for the students of each activated course.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.db.models import (
    Course,
    IcfesActivation,
    IcfesAttempt,
    IcfesSimulator,
    IcfesSimulatorSchool,
    StudentEnrollment,
)

# The scale of the exam: the module already scores 0 to 500.
MAX_SCORE = 500

# The states in which a simulator can still be activated by a school. A
# draft or an archived simulator is not run by anybody.
_ACTIVATABLE = ("publicado", "en_curso")


async def list_simulators(session: AsyncSession, school_id: uuid.UUID) -> dict[str, Any]:
    """The simulators the platform team enabled for the school.

    With the courses each one runs in and the deadline of each one. The
    indicators at the top come from these same rows: the school never
    sees a number that is not counted here.
    """
    result = await session.execute(
        select(
            IcfesSimulator.id,
            IcfesSimulator.code,
            IcfesSimulator.name,
            IcfesSimulator.grade,
            IcfesSimulator.question_count,
            IcfesSimulator.duration_min,
            IcfesSimulator.scheduled_at,
            IcfesSimulator.status,
            IcfesSimulator.average_score,
            IcfesSimulator.simulation_id,
            IcfesSimulatorSchool.enabled_at,
        )
        .join(IcfesSimulatorSchool, IcfesSimulatorSchool.simulator_id == IcfesSimulator.id)
        .where(
            IcfesSimulatorSchool.school_id == school_id,
            IcfesSimulator.status.notin_(("borrador", "en_revision", "archivado")),
        )
        .order_by(IcfesSimulator.scheduled_at.desc().nullslast(), IcfesSimulator.code)
    )

    simulators = result.all()

    activations = await _activations_of(
        session,
        school_id,
        [row[0] for row in simulators],
    )

    items = []
    for row in simulators:
        (
            simulator_id,
            code,
            name,
            grade,
            question_count,
            duration_min,
            scheduled_at,
            status,
            average_score,
            simulation_id,
            enabled_at,
        ) = row

        runs = activations.get(simulator_id, [])
        items.append(
            {
                "id": str(simulator_id),
                "code": code,
                "name": name,
                "grade": grade,
                "question_count": question_count,
                "duration_min": duration_min,
                "scheduled_at": scheduled_at,
                "status": status,
                "average_score": float(average_score) if average_score is not None else None,
                "enabled_at": enabled_at,
                "activated": bool(runs),
                "activations": runs,
            }
        )

    activated_count = sum(1 for item in items if item["activated"])
    not_activated_count = len(items) - activated_count

    return {
        "items": items,
        "kpis": {
            "available": len(items),
            "not_activated": not_activated_count,
            "activated": activated_count,
            "activated_courses": len(
                {run["course_id"] for item in items for run in item["activations"]}
            ),
            # The average of each grade, on the scale of the exam. The
            # interface shows the grades that have one, without a list
            # of grades hardcoded in the frontend.
            "averages_by_grade": _averages_by_grade(items),
            "max_score": MAX_SCORE,
        },
    }


def _averages_by_grade(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The average score of each grade, over the simulators that have one.

    A simulator without average (it was not corrected yet) does not
    lower the average of its grade: it simply does not count.

    Each grade also carries its last cut and the difference with the
    one before it, so the panel can say whether the school is going up
    or down.
    """
    totals: dict[str, list[float]] = {}
    cuts: dict[str, list[tuple[date | None, float]]] = {}
    for item in items:
        score = item["average_score"]
        if score is None:
            continue
        totals.setdefault(item["grade"], []).append(score)
        cuts.setdefault(item["grade"], []).append((item["scheduled_at"], score))

    averages = []
    for grade, scores in sorted(totals.items()):
        ordered = sorted(cuts[grade], key=lambda cut: (cut[0] is None, cut[0] or date.min))
        latest = ordered[-1][1]
        previous = ordered[-2][1] if len(ordered) > 1 else None
        averages.append(
            {
                "grade": grade,
                "average_score": round(sum(scores) / len(scores), 2),
                "latest_average": round(latest, 2),
                "previous_average": round(previous, 2) if previous is not None else None,
                "delta": round(latest - previous, 2) if previous is not None else None,
            }
        )

    return averages


async def _activations_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    simulator_ids: list[uuid.UUID],
) -> dict[uuid.UUID, list[dict[str, Any]]]:
    """The courses each simulator runs in, with its deadline."""
    if not simulator_ids:
        return {}

    result = await session.execute(
        select(
            IcfesActivation.simulator_id,
            IcfesActivation.course_id,
            IcfesActivation.deadline,
            IcfesActivation.activated_at,
            Course.name,
        )
        .join(Course, Course.id == IcfesActivation.course_id)
        .where(
            IcfesActivation.school_id == school_id,
            IcfesActivation.simulator_id.in_(simulator_ids),
        )
        .order_by(Course.name)
    )

    activations: dict[uuid.UUID, list[dict[str, Any]]] = {}
    for simulator_id, course_id, deadline, activated_at, course_name in result.all():
        activations.setdefault(simulator_id, []).append(
            {
                "course_id": str(course_id),
                "course_name": course_name,
                "deadline": deadline,
                "activated_at": activated_at,
            }
        )

    return activations


async def activate(
    session: AsyncSession,
    school_id: uuid.UUID,
    simulator_id: uuid.UUID,
    course_ids: list[uuid.UUID],
    deadline: date,
) -> dict[str, Any]:
    """Activate a simulator in some courses of the school.

    The school only activates what the platform enabled: a simulator
    that is not enabled for this school answers 404. The courses have to
    belong to the school, and activating the same simulator twice in
    the same course updates the deadline instead of failing.
    """
    simulator = await _enabled_simulator(session, school_id, simulator_id)

    if simulator.status not in _ACTIVATABLE:
        raise ConflictError(
            "Este simulacro todavía no está publicado: no se puede activar.",
            code="simulator_not_published",
        )

    if not course_ids:
        raise ValidationError(
            "Elige al menos un curso para activar el simulacro.",
            code="missing_courses",
        )

    courses = await _courses_of(session, school_id, course_ids)
    if len(courses) != len(set(course_ids)):
        raise ValidationError(
            "Alguno de los cursos no existe en tu colegio.",
            code="unknown_course",
        )

    for course_id in course_ids:
        existing = await session.execute(
            select(IcfesActivation).where(
                IcfesActivation.school_id == school_id,
                IcfesActivation.simulator_id == simulator_id,
                IcfesActivation.course_id == course_id,
            )
        )
        activation = existing.scalar_one_or_none()
        if activation is None:
            activation = IcfesActivation(
                school_id=school_id,
                simulator_id=simulator_id,
                course_id=course_id,
                deadline=deadline,
            )
            session.add(activation)
        else:
            activation.deadline = deadline

    await session.commit()

    return {
        "simulator_id": str(simulator_id),
        "courses": sorted(courses),
        "deadline": deadline,
    }


async def _enabled_simulator(
    session: AsyncSession,
    school_id: uuid.UUID,
    simulator_id: uuid.UUID,
) -> IcfesSimulator:
    """The simulator, if the platform enabled it for this school.

    A simulator that belongs to another school answers 404: the
    endpoint must not confirm that it exists.
    """
    result = await session.execute(
        select(IcfesSimulator)
        .join(
            IcfesSimulatorSchool,
            IcfesSimulatorSchool.simulator_id == IcfesSimulator.id,
        )
        .where(
            IcfesSimulatorSchool.school_id == school_id,
            IcfesSimulator.id == simulator_id,
        )
    )
    simulator = result.scalar_one_or_none()
    if simulator is None:
        raise NotFoundError("Simulator not found.")
    return simulator


async def _courses_of(
    session: AsyncSession,
    school_id: uuid.UUID,
    course_ids: list[uuid.UUID],
) -> list[str]:
    """The names of the courses of the school."""
    if not course_ids:
        return []

    result = await session.execute(
        select(Course.name).where(
            Course.school_id == school_id,
            Course.id.in_(course_ids),
        )
    )
    return [name for name in result.scalars().all()]


async def simulator_results(
    session: AsyncSession,
    school_id: uuid.UUID,
    simulator_id: uuid.UUID,
) -> dict[str, Any]:
    """The simulator with the result of each course it runs in.

    The result is the one of the attempts of the exam the simulator
    points to, counted only for the students of the activated courses:
    the number of students that took it and the average score.
    """
    simulator = await _enabled_simulator(session, school_id, simulator_id)

    result = await session.execute(
        select(
            IcfesSimulator.code,
            IcfesSimulator.name,
            IcfesSimulator.grade,
            IcfesSimulator.question_count,
            IcfesSimulator.duration_min,
            IcfesSimulator.scheduled_at,
            IcfesSimulator.status,
            IcfesSimulator.average_score,
            IcfesSimulator.simulation_id,
        ).where(IcfesSimulator.id == simulator.id)
    )
    (
        code,
        name,
        grade,
        question_count,
        duration_min,
        scheduled_at,
        status,
        average_score,
        simulation_id,
    ) = result.one()

    activations = await _activations_of(session, school_id, [simulator.id])
    runs = activations.get(simulator.id, [])

    scores = await _scores_by_course(session, school_id, simulation_id)

    courses = []
    for run in runs:
        course_score = scores.get(uuid.UUID(run["course_id"]))
        courses.append(
            {
                **run,
                "students": course_score["students"] if course_score else 0,
                "average_score": course_score["average"] if course_score else None,
            }
        )

    return {
        "id": str(simulator.id),
        "code": code,
        "name": name,
        "grade": grade,
        "question_count": question_count,
        "duration_min": duration_min,
        "scheduled_at": scheduled_at,
        "status": status,
        "average_score": float(average_score) if average_score is not None else None,
        "max_score": MAX_SCORE,
        "courses": courses,
    }


async def _scores_by_course(
    session: AsyncSession,
    school_id: uuid.UUID,
    simulation_id: uuid.UUID | None,
) -> dict[uuid.UUID, dict[str, Any]]:
    """How many students of each course took the exam, and their average.

    The students come from the enrollments of the school: a student of
    another school does not count, even if they took the same exam.
    """
    if simulation_id is None:
        return {}

    result = await session.execute(
        select(
            StudentEnrollment.course_id,
            func.count(IcfesAttempt.id),
            func.round(func.avg(IcfesAttempt.global_score), 2),
        )
        .select_from(StudentEnrollment)
        .join(
            IcfesAttempt,
            (IcfesAttempt.student_id == StudentEnrollment.student_id)
            & (IcfesAttempt.simulation_id == simulation_id),
        )
        .where(
            StudentEnrollment.school_id == school_id,
            StudentEnrollment.status == "active",
            IcfesAttempt.global_score.is_not(None),
        )
        .group_by(StudentEnrollment.course_id)
    )

    return {
        course_id: {"students": int(students), "average": float(average) if average else None}
        for course_id, students, average in result.all()
    }


__all__ = ["activate", "list_simulators", "simulator_results"]
