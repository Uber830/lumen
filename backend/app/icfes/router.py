"""ICFES attempts router.

Routes
------

- POST /v1/icfes/simulations/{simulation_id}/attempts: start an attempt.
  Returns { attempt_id, questions: [{ id, prompt, options, reading }] }
  (NO answer keys).

- POST /v1/icfes/attempts/{attempt_id}/finalize: submit answers and score.
  Body: { answers: [{ question_id, chosen_index }] }
  Returns the IcfesAttemptScore plus the per-area breakdown.

The scoring happens server-side because the answer keys must never
reach the student: `icfes_answer_keys` is restricted to admins and
teachers. The finalization is atomic: the backend validates
ownership, sets the status to 'graded', and writes the score and the
per-area rows in the same transaction.

The school must have the ICFES entitlement; otherwise the backend
returns 403 even if the caller is a valid member.

Idempotency: calling finalize twice with the same answers is safe; the
second call updates existing rows instead of duplicating them.

Phase 2: the school is resolved from the request context, and the
attempt is checked against the caller's own membership before it is
read. A caller from another school cannot even reach the attempt.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.permissions import school_has_icfes
from app.db.enums import IcfesAttemptStatus
from app.db.models import (
    IcfesAnswer,
    IcfesAnswerKey,
    IcfesAttempt,
    IcfesQuestion,
    IcfesScore,
    IcfesSimulation,
    IcfesSimulationQuestion,
)
from app.db.session import get_db
from app.deps import get_context
from app.icfes.scoring import IcfesQuestionInput, score_attempt

router = APIRouter(prefix="/v1/icfes", tags=["icfes"])


class FinalizeAnswer(BaseModel):
    question_id: UUID
    chosen_index: int | None = Field(default=None, ge=0, le=3)


class FinalizeRequest(BaseModel):
    answers: list[FinalizeAnswer]


def _resolve_school_id(context: RequestContext) -> UUID:
    """The school the caller is working in."""
    membership = context.require_any_membership()
    return membership.school_id


async def _require_icfes_entitlement(
    session: AsyncSession,
    school_id: UUID,
) -> None:
    """Raise 403 if the school does not have the ICFES entitlement."""
    if not await school_has_icfes(session, school_id=school_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="School does not have ICFES entitlement.",
        )


@router.post("/simulations/{simulation_id}/attempts", status_code=status.HTTP_201_CREATED)
async def start_attempt(
    simulation_id: UUID,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Create an in-progress attempt and return the questions (no keys)."""
    school_id = _resolve_school_id(context)
    await _require_icfes_entitlement(session, school_id)

    sim_result = await session.execute(
        select(IcfesSimulation).where(
            IcfesSimulation.id == simulation_id,
            IcfesSimulation.school_id == school_id,
        )
    )
    simulation = sim_result.scalar_one_or_none()
    if simulation is None or not simulation.is_published:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulation not found or not published.",
        )

    # Idempotent: if the student already has an attempt for this
    # simulation, return the existing one instead of creating a
    # duplicate.
    existing_result = await session.execute(
        select(IcfesAttempt).where(
            IcfesAttempt.simulation_id == simulation_id,
            IcfesAttempt.student_id == context.user_id,
        )
    )
    existing = existing_result.scalar_one_or_none()
    if existing is not None:
        attempt_id = existing.id
    else:
        attempt = IcfesAttempt(
            id=uuid.uuid4(),
            school_id=school_id,
            simulation_id=simulation_id,
            student_id=context.user_id,
            status=IcfesAttemptStatus.IN_PROGRESS,
        )
        session.add(attempt)
        await session.flush()
        attempt_id = attempt.id
        await session.commit()

    # Load the questions for this simulation. Position is preserved.
    questions_result = await session.execute(
        select(
            IcfesSimulationQuestion.position,
            IcfesQuestion.id,
            IcfesQuestion.area,
            IcfesQuestion.prompt,
            IcfesQuestion.reading,
            IcfesQuestion.options,
            IcfesQuestion.points,
        )
        .join(IcfesQuestion, IcfesQuestion.id == IcfesSimulationQuestion.question_id)
        .where(IcfesSimulationQuestion.simulation_id == simulation_id)
        .order_by(IcfesSimulationQuestion.position.asc())
    )

    questions_payload = [
        {
            "id": str(row.id),
            "area": row.area,
            "prompt": row.prompt,
            "reading": row.reading,
            "options": row.options,
            "points": float(row.points or 1.0),
        }
        for row in questions_result.all()
    ]
    return {
        "attempt_id": str(attempt_id),
        "simulation_id": str(simulation_id),
        "questions": questions_payload,
    }


@router.post("/attempts/{attempt_id}/finalize")
async def finalize_attempt(
    attempt_id: UUID,
    body: FinalizeRequest,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> dict[str, Any]:
    """Submit answers and score the attempt server-side.

    Returns the IcfesAttemptScore as JSON: global_score, max_score,
    percent, puntaje_global (0-500), by_area, correct_count,
    question_count.
    """
    school_id = _resolve_school_id(context)
    await _require_icfes_entitlement(session, school_id)

    attempt_result = await session.execute(
        select(IcfesAttempt).where(
            IcfesAttempt.id == attempt_id,
            IcfesAttempt.school_id == school_id,
        )
    )
    attempt = attempt_result.scalar_one_or_none()
    if attempt is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Attempt not found.",
        )
    if attempt.student_id != context.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Attempt does not belong to the caller.",
        )
    if attempt.status == IcfesAttemptStatus.GRADED:
        # Already graded: return the prior score so retries are
        # idempotent.
        return await _existing_score_response(session, attempt_id)

    # Load the questions and the answer keys for this simulation.
    questions_result = await session.execute(
        select(
            IcfesSimulationQuestion.position,
            IcfesQuestion.id,
            IcfesQuestion.area,
            IcfesQuestion.points,
        )
        .join(IcfesQuestion, IcfesQuestion.id == IcfesSimulationQuestion.question_id)
        .where(IcfesSimulationQuestion.simulation_id == attempt.simulation_id)
        .order_by(IcfesSimulationQuestion.position.asc())
    )
    questions = [
        {
            "id": str(row.id),
            "area": row.area,
            "points": float(row.points or 1.0),
        }
        for row in questions_result.all()
    ]
    question_ids = [uuid.UUID(q["id"]) for q in questions]

    correct: dict[str, int] = {}
    if question_ids:
        keys_result = await session.execute(
            select(IcfesAnswerKey).where(IcfesAnswerKey.question_id.in_(question_ids))
        )
        correct = {
            str(key.question_id): int(key.correct_index) for key in keys_result.scalars().all()
        }

    chosen: dict[str, int | None] = {str(a.question_id): a.chosen_index for a in body.answers}

    q_inputs = [IcfesQuestionInput(**q) for q in questions]
    result = score_attempt(q_inputs, chosen, correct)

    # Persist answers (upsert) and the attempt score + status.
    if body.answers:
        await session.execute(
            pg_insert(IcfesAnswer)
            .values(
                [
                    {
                        "school_id": school_id,
                        "attempt_id": attempt_id,
                        "question_id": answer.question_id,
                        "chosen_index": answer.chosen_index,
                    }
                    for answer in body.answers
                ]
            )
            .on_conflict_do_update(
                index_elements=[IcfesAnswer.attempt_id, IcfesAnswer.question_id],
                set_={"chosen_index": IcfesAnswer.chosen_index},
            )
        )

    attempt.status = IcfesAttemptStatus.GRADED
    attempt.submitted_at = attempt.submitted_at or datetime.now(UTC)
    attempt.graded_at = datetime.now(UTC)
    # The columns are NUMERIC in Postgres; the scorer works in floats.
    attempt.global_score = Decimal(str(result.global_score))
    attempt.max_score = Decimal(str(result.max_score))
    attempt.percent = Decimal(str(result.percent))

    # Write per-area scores.
    if result.by_area:
        await session.execute(
            pg_insert(IcfesScore)
            .values(
                [
                    {
                        "attempt_id": attempt_id,
                        "school_id": school_id,
                        "area": agg.area,
                        "correct": agg.correct,
                        "total": agg.total,
                        "percent": Decimal(str(agg.percent)),
                    }
                    for agg in result.by_area.values()
                ]
            )
            .on_conflict_do_update(
                index_elements=[IcfesScore.attempt_id, IcfesScore.area],
                set_={
                    "correct": IcfesScore.correct,
                    "total": IcfesScore.total,
                    "percent": IcfesScore.percent,
                },
            )
        )

    await session.commit()

    return {
        "attempt_id": str(attempt_id),
        "global_score": result.global_score,
        "max_score": result.max_score,
        "percent": result.percent,
        "puntaje_global": result.puntaje_global,
        "by_area": [
            {
                "area": a.area,
                "correct": a.correct,
                "total": a.total,
                "percent": a.percent,
            }
            for a in result.by_area.values()
        ],
        "correct_count": result.correct_count,
        "question_count": result.question_count,
    }


async def _existing_score_response(
    session: AsyncSession,
    attempt_id: UUID,
) -> dict[str, Any]:
    """Return the previously stored score for an already-graded attempt."""
    attempt_result = await session.execute(
        select(IcfesAttempt).where(IcfesAttempt.id == attempt_id)
    )
    attempt = attempt_result.scalar_one_or_none()

    scores_result = await session.execute(
        select(IcfesScore).where(IcfesScore.attempt_id == attempt_id)
    )
    scores = scores_result.scalars().all()

    percent = float(attempt.percent or 0) if attempt else 0.0
    return {
        "attempt_id": str(attempt_id),
        "global_score": float(attempt.global_score or 0) if attempt else 0.0,
        "max_score": float(attempt.max_score or 0) if attempt else 0.0,
        "percent": percent,
        "puntaje_global": int(round(percent * 5)),
        "by_area": [
            {
                "area": score.area,
                "correct": score.correct,
                "total": score.total,
                "percent": float(score.percent or 0),
            }
            for score in scores
        ],
        "correct_count": 0,
        "question_count": 0,
    }
