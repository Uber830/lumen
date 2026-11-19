"""ICFES authoring router: the question bank and the simulations.

The attempt lifecycle (start, submit, score) is in `app/icfes/router.py`.
This router is about authoring: the bank, the answer keys and the
simulations.

The rules from the RLS policies:

- the question bank and its answer keys are for the school admins and
  the assigned teachers;
- a simulation is read by the admins, the assigned teacher, or an
  enrolled student when it is published;
- writing is for the assigned teacher.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import can_write_course_subject
from app.core.context import RequestContext
from app.core.errors import ForbiddenError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context
from app.icfes import authoring
from app.icfes.schemas import (
    AnswerKeyCreate,
    AnswerKeyOut,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
    SimulationCreate,
    SimulationOut,
    SimulationUpdate,
)

router = APIRouter(prefix="/v1/icfes", tags=["icfes-authoring"])


def _changes(body: BaseModel) -> dict[str, object]:
    return body.model_dump(exclude_unset=True)


async def _require_author_access(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> None:
    """Require the caller to be a school admin or the assigned teacher.

    The question bank is not readable by the students: they get the
    questions of a simulation through the attempt endpoint.
    """
    if context.role_in(school_id) == SchoolRole.SCHOOL_ADMIN:
        return
    if await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=course_subject_id,
    ):
        return
    raise ForbiddenError(
        "You do not have access to the ICFES question bank.",
        code="icfes_forbidden",
    )


# ---------------------------------------------------------------------------
# The question bank
# ---------------------------------------------------------------------------


@router.get("/questions", response_model=list[QuestionOut])
async def list_questions(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    area: Annotated[str | None, Query()] = None,
    grado: Annotated[str | None, Query()] = None,
) -> list[QuestionOut]:
    """List the bank's questions."""
    school_id = context.require_any_membership().school_id
    questions = await authoring.list_questions(session, school_id=school_id, area=area, grado=grado)
    return [QuestionOut.model_validate(q, from_attributes=True) for q in questions]


@router.post("/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question(
    body: QuestionCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> QuestionOut:
    """Add a question to the bank."""
    school_id = context.require_any_membership().school_id
    if context.role_in(school_id) != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only a school administrator can add questions to the bank.",
            code="icfes_forbidden",
        )

    question = await authoring.create_question(
        session,
        school_id=school_id,
        area=body.area,
        grado=body.grado,
        difficulty=body.difficulty,
        competencia=body.competencia,
        prompt=body.prompt,
        reading=body.reading,
        options=body.options,
        points=body.points,
    )
    await session.commit()
    return QuestionOut.model_validate(question, from_attributes=True)


@router.patch("/questions/{question_id}", response_model=QuestionOut)
async def update_question(
    body: QuestionUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    question_id: Annotated[uuid.UUID, Path()],
) -> QuestionOut:
    """Update a question of the bank."""
    school_id = context.require_any_membership().school_id
    # The question has to exist and belong to the school. The call is
    # the check; the row itself is not needed here.
    await authoring.get_question(session, question_id=question_id, school_id=school_id)

    if context.role_in(school_id) != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only a school administrator can edit the question bank.",
            code="icfes_forbidden",
        )

    updated = await authoring.update_question(
        session,
        question_id=question_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return QuestionOut.model_validate(updated, from_attributes=True)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    question_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a question from the bank."""
    school_id = context.require_any_membership().school_id
    await authoring.get_question(session, question_id=question_id, school_id=school_id)

    if context.role_in(school_id) != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only a school administrator can delete from the question bank.",
            code="icfes_forbidden",
        )

    await authoring.delete_question(session, question_id=question_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Answer keys
# ---------------------------------------------------------------------------


@router.put("/answer-keys", response_model=AnswerKeyOut, status_code=status.HTTP_201_CREATED)
async def set_answer_key(
    body: AnswerKeyCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> AnswerKeyOut:
    """Set the answer key of a question, replacing the previous one."""
    school_id = context.require_any_membership().school_id
    question = await authoring.get_question(
        session, question_id=body.question_id, school_id=school_id
    )

    if context.role_in(school_id) != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only a school administrator can set the answer keys.",
            code="icfes_forbidden",
        )

    key = await authoring.set_answer_key(
        session,
        school_id=school_id,
        question_id=question.id,
        correct_index=body.correct_index,
    )
    await session.commit()
    return AnswerKeyOut.model_validate(key, from_attributes=True)


@router.get("/answer-keys", response_model=list[AnswerKeyOut])
async def list_answer_keys(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    question_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[AnswerKeyOut]:
    """List the answer keys.

    Only a school administrator reaches them. The students get the
    questions of a simulation through the attempt endpoint, which never
    includes the keys.
    """
    school_id = context.require_any_membership().school_id
    if context.role_in(school_id) != SchoolRole.SCHOOL_ADMIN:
        raise ForbiddenError(
            "Only a school administrator can read the answer keys.",
            code="icfes_forbidden",
        )

    if question_id is not None:
        question_ids = [question_id]
    else:
        from sqlalchemy import select

        from app.db.models import IcfesQuestion

        result = await session.execute(
            select(IcfesQuestion.id).where(IcfesQuestion.school_id == school_id)
        )
        question_ids = list(result.scalars().all())

    keys = await authoring.list_answer_keys(session, question_ids=question_ids)
    return [AnswerKeyOut.model_validate(k, from_attributes=True) for k in keys]


# ---------------------------------------------------------------------------
# Simulations
# ---------------------------------------------------------------------------


@router.get("/simulations", response_model=list[SimulationOut])
async def list_simulations(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_subject_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[SimulationOut]:
    """List the simulations the caller may read."""
    school_id = context.require_any_membership().school_id
    simulations = await authoring.list_simulations(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=course_subject_id,
    )
    counts = await authoring.simulation_question_counts(
        session, school_id=school_id, simulation_ids=[s.id for s in simulations]
    )
    return [
        SimulationOut(
            **SimulationOut.model_validate(s, from_attributes=True).model_dump(
                exclude={"question_count"}
            ),
            question_count=counts.get(s.id, 0),
        )
        for s in simulations
    ]


@router.post(
    "/simulations",
    response_model=SimulationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_simulation(
    body: SimulationCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> SimulationOut:
    """Create a simulation and attach its questions."""
    school_id = context.require_any_membership().school_id

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=body.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can create simulations.",
            code="course_subject_forbidden",
        )

    simulation = await authoring.create_simulation(
        session,
        school_id=school_id,
        posted_by=context.user_id,
        course_subject_id=body.course_subject_id,
        title=body.title,
        description=body.description,
        duration_minutes=body.duration_minutes,
        available_from=body.available_from,
        available_until=body.available_until,
        is_published=body.is_published,
        randomize_questions=body.randomize_questions,
        randomize_options=body.randomize_options,
        question_ids=body.question_ids,
    )
    await session.commit()
    return SimulationOut.model_validate(simulation, from_attributes=True)


@router.patch("/simulations/{simulation_id}", response_model=SimulationOut)
async def update_simulation(
    body: SimulationUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    simulation_id: Annotated[uuid.UUID, Path()],
) -> SimulationOut:
    """Update a simulation."""
    school_id = context.require_any_membership().school_id
    simulation = await authoring.get_simulation(
        session, simulation_id=simulation_id, school_id=school_id
    )

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=simulation.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can edit it.",
            code="course_subject_forbidden",
        )

    updated = await authoring.update_simulation(
        session,
        simulation_id=simulation_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return SimulationOut.model_validate(updated, from_attributes=True)


@router.delete(
    "/simulations/{simulation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_simulation(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    simulation_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a simulation."""
    school_id = context.require_any_membership().school_id
    simulation = await authoring.get_simulation(
        session, simulation_id=simulation_id, school_id=school_id
    )

    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=simulation.course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can delete it.",
            code="course_subject_forbidden",
        )

    await authoring.delete_simulation(session, simulation_id=simulation_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
