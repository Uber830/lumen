"""ICFES authoring operations.

The question bank, the simulations and their answer keys. The attempt
lifecycle is in `app/icfes/router.py`.

The rules come from the RLS policies the migrations declared:

- **questions**: read by a school admin or the assigned teacher. The
  students never see the bank directly; they get the questions of a
  simulation through the attempt endpoint.
- **answer keys**: the teacher and the admins only.
- **simulations**: read by a school admin, the assigned teacher, or an
  enrolled student when the simulation is published; written by the
  assigned teacher.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import ConflictError, NotFoundError
from app.db.enums import SchoolRole
from app.db.models import (
    IcfesAnswerKey,
    IcfesQuestion,
    IcfesSimulation,
    IcfesSimulationQuestion,
)

# ---------------------------------------------------------------------------
# The question bank
# ---------------------------------------------------------------------------


async def list_questions(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    area: str | None = None,
    grado: str | None = None,
) -> list[IcfesQuestion]:
    """List the bank's questions.

    Only a school admin or the assigned teacher reads the bank. The
    students get the questions of a simulation through the attempt
    endpoint, which never includes the keys.
    """
    statement = select(IcfesQuestion).where(IcfesQuestion.school_id == school_id)
    if area is not None:
        statement = statement.where(IcfesQuestion.area == area)
    if grado is not None:
        statement = statement.where(IcfesQuestion.grado == grado)

    result = await session.execute(statement.order_by(IcfesQuestion.created_at.desc()))
    return list(result.scalars().all())


async def get_question(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    school_id: uuid.UUID,
) -> IcfesQuestion:
    """Load one question, scoped to the school."""
    result = await session.execute(
        select(IcfesQuestion).where(
            IcfesQuestion.id == question_id,
            IcfesQuestion.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Question not found.")
    return row


async def create_question(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    area: str,
    grado: str,
    difficulty: str,
    competencia: str | None,
    prompt: str,
    reading: str | None,
    options: list[str],
    points: Decimal,
) -> IcfesQuestion:
    """Add a question to the bank."""
    question = IcfesQuestion(
        id=uuid.uuid4(),
        school_id=school_id,
        area=area,
        grado=grado,
        difficulty=difficulty,
        competencia=competencia,
        prompt=prompt,
        reading=reading,
        options=options,
        points=points,
    )
    session.add(question)
    await session.flush()
    return question


async def update_question(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> IcfesQuestion:
    """Apply a partial update to a question."""
    question = await get_question(session, question_id=question_id, school_id=school_id)
    for field, value in changes.items():
        if value is not None:
            setattr(question, field, value)
    await session.flush()
    return question


async def delete_question(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a question from the bank."""
    question = await get_question(session, question_id=question_id, school_id=school_id)
    await session.delete(question)
    await session.flush()


# ---------------------------------------------------------------------------
# Answer keys
# ---------------------------------------------------------------------------


async def set_answer_key(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    question_id: uuid.UUID,
    correct_index: int,
) -> IcfesAnswerKey:
    """Set the answer key of a question, replacing the previous one."""
    existing = await session.execute(
        select(IcfesAnswerKey).where(IcfesAnswerKey.question_id == question_id)
    )
    row = existing.scalar_one_or_none()
    if row is not None:
        row.correct_index = correct_index
        await session.flush()
        return row

    key = IcfesAnswerKey(
        id=uuid.uuid4(),
        school_id=school_id,
        question_id=question_id,
        correct_index=correct_index,
    )
    session.add(key)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("That question already has an answer key.") from exc
    return key


async def list_answer_keys(
    session: AsyncSession,
    *,
    question_ids: list[uuid.UUID],
) -> list[IcfesAnswerKey]:
    """List the answer keys of the given questions."""
    if not question_ids:
        return []
    result = await session.execute(
        select(IcfesAnswerKey).where(IcfesAnswerKey.question_id.in_(question_ids))
    )
    return list(result.scalars().all())


# ---------------------------------------------------------------------------
# Simulations
# ---------------------------------------------------------------------------


async def list_simulations(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID | None = None,
) -> list[IcfesSimulation]:
    """List the simulations the caller may read.

    A student only sees the published ones.
    """
    statement = select(IcfesSimulation).where(IcfesSimulation.school_id == school_id)
    if course_subject_id is not None:
        statement = statement.where(IcfesSimulation.course_subject_id == course_subject_id)

    result = await session.execute(
        statement.order_by(IcfesSimulation.available_until.asc().nullslast())
    )
    rows = list(result.scalars().all())

    from app.core.access import can_read_course_subject

    visible: list[IcfesSimulation] = []
    for simulation in rows:
        if not await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=simulation.course_subject_id,
        ):
            continue
        if not simulation.is_published and context.role_in(school_id) == SchoolRole.STUDENT:
            continue
        visible.append(simulation)
    return visible


async def get_simulation(
    session: AsyncSession,
    *,
    simulation_id: uuid.UUID,
    school_id: uuid.UUID,
) -> IcfesSimulation:
    """Load one simulation, scoped to the school."""
    result = await session.execute(
        select(IcfesSimulation).where(
            IcfesSimulation.id == simulation_id,
            IcfesSimulation.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Simulation not found.")
    return row


async def create_simulation(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    posted_by: uuid.UUID,
    course_subject_id: uuid.UUID,
    title: str,
    description: str | None,
    duration_minutes: int | None,
    available_from: datetime | None,
    available_until: datetime | None,
    is_published: bool,
    randomize_questions: bool,
    randomize_options: bool,
    question_ids: list[uuid.UUID],
) -> IcfesSimulation:
    """Create a simulation and attach its questions."""
    simulation = IcfesSimulation(
        id=uuid.uuid4(),
        school_id=school_id,
        course_subject_id=course_subject_id,
        posted_by=posted_by,
        title=title,
        description=description,
        duration_minutes=duration_minutes,
        available_from=available_from,
        available_until=available_until,
        is_published=is_published,
        randomize_questions=randomize_questions,
        randomize_options=randomize_options,
    )
    session.add(simulation)
    await session.flush()

    await _attach_questions(
        session,
        school_id=school_id,
        simulation_id=simulation.id,
        question_ids=question_ids,
    )
    return simulation


async def _attach_questions(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    simulation_id: uuid.UUID,
    question_ids: list[uuid.UUID],
) -> None:
    """Attach questions to a simulation, in order.

    The questions have to belong to the school.
    """
    if not question_ids:
        return

    result = await session.execute(
        select(IcfesQuestion).where(
            IcfesQuestion.id.in_(question_ids),
            IcfesQuestion.school_id == school_id,
        )
    )
    found = {row.id for row in result.scalars().all()}
    missing = [qid for qid in question_ids if qid not in found]
    if missing:
        raise NotFoundError("One or more questions were not found.")

    for position, question_id in enumerate(question_ids, start=1):
        session.add(
            IcfesSimulationQuestion(
                id=uuid.uuid4(),
                school_id=school_id,
                simulation_id=simulation_id,
                question_id=question_id,
                position=position,
            )
        )
    await session.flush()


async def update_simulation(
    session: AsyncSession,
    *,
    simulation_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> IcfesSimulation:
    """Apply a partial update to a simulation."""
    simulation = await get_simulation(session, simulation_id=simulation_id, school_id=school_id)
    for field, value in changes.items():
        if value is not None:
            setattr(simulation, field, value)
    await session.flush()
    return simulation


async def delete_simulation(
    session: AsyncSession,
    *,
    simulation_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete a simulation."""
    simulation = await get_simulation(session, simulation_id=simulation_id, school_id=school_id)
    await session.delete(simulation)
    await session.flush()


async def simulation_question_counts(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    simulation_ids: list[uuid.UUID],
) -> dict[uuid.UUID, int]:
    """Return {simulation_id: question_count}."""
    if not simulation_ids:
        return {}

    result = await session.execute(
        select(
            IcfesSimulationQuestion.simulation_id,
            func.count(IcfesSimulationQuestion.id),
        )
        .where(
            IcfesSimulationQuestion.school_id == school_id,
            IcfesSimulationQuestion.simulation_id.in_(simulation_ids),
        )
        .group_by(IcfesSimulationQuestion.simulation_id)
    )
    return {row[0]: int(row[1]) for row in result.all()}


__all__ = [
    "create_question",
    "create_simulation",
    "delete_question",
    "delete_simulation",
    "get_question",
    "get_simulation",
    "list_answer_keys",
    "list_questions",
    "list_simulations",
    "set_answer_key",
    "simulation_question_counts",
    "update_question",
    "update_simulation",
]
