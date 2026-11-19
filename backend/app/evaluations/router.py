"""Evaluations router: the authored assessments and their attempts.

The answer keys are the sensitive part: only the teacher of the course
subject and the school admins can read them. A student receives the
questions and their own answers, never the keys.

The attempt lifecycle is here rather than in the browser because the
scoring needs the keys.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import (
    can_read_course_subject,
    can_write_course_subject,
)
from app.core.context import RequestContext
from app.core.errors import ForbiddenError, NotFoundError
from app.db.enums import EvaluationAttemptStatus, SchoolRole
from app.db.models import EvaluationAnswer, EvaluationQuestion
from app.db.session import get_db
from app.deps import get_context
from app.evaluations import operations
from app.evaluations.schemas import (
    AnswerCreate,
    AnswerKeyCreate,
    AnswerKeyOut,
    AnswerOut,
    AttemptOut,
    EvaluationCreate,
    EvaluationOut,
    EvaluationUpdate,
    GradeAnswerRequest,
    QuestionCreate,
    QuestionOut,
    QuestionUpdate,
)

router = APIRouter(prefix="/v1/evaluations", tags=["evaluations"])


def _changes(body: BaseModel) -> dict[str, object]:
    """The fields of a partial update that were actually sent."""
    return body.model_dump(exclude_unset=True)


async def _require_teacher_access(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> None:
    """Require the caller to be the teacher of the course subject."""
    if not await can_write_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=course_subject_id,
    ):
        raise ForbiddenError(
            "Only the teacher assigned to this course subject can do that.",
            code="course_subject_forbidden",
        )


async def _require_admin_access(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> None:
    """Require the caller to be a teacher of it or a school admin.

    The answer keys are readable by the teacher and the admins.
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
        "You do not have access to this course subject.",
        code="course_subject_forbidden",
    )


# ---------------------------------------------------------------------------
# Evaluations
# ---------------------------------------------------------------------------


@router.get("", response_model=list[EvaluationOut])
async def list_evaluations(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    course_subject_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[EvaluationOut]:
    """List the evaluations the caller may read.

    A student only sees the published ones.
    """
    school_id = context.require_any_membership().school_id
    evaluations = await operations.list_evaluations(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=course_subject_id,
    )
    return [EvaluationOut.model_validate(e, from_attributes=True) for e in evaluations]


@router.post("", response_model=EvaluationOut, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    body: EvaluationCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> EvaluationOut:
    """Create an evaluation."""
    school_id = context.require_any_membership().school_id
    await _require_teacher_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=body.course_subject_id,
    )

    evaluation = await operations.create_evaluation(
        session,
        school_id=school_id,
        posted_by=context.user_id,
        course_subject_id=body.course_subject_id,
        title=body.title,
        description=body.description,
        duration_minutes=body.duration_minutes,
        due_at=body.due_at,
        is_published=body.is_published,
    )
    await session.commit()
    return EvaluationOut.model_validate(evaluation, from_attributes=True)


@router.patch("/{evaluation_id}", response_model=EvaluationOut)
async def update_evaluation(
    body: EvaluationUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID, Path()],
) -> EvaluationOut:
    """Update an evaluation."""
    school_id = context.require_any_membership().school_id
    evaluation = await operations.get_evaluation(
        session, evaluation_id=evaluation_id, school_id=school_id
    )
    await _require_teacher_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    updated = await operations.update_evaluation(
        session,
        evaluation_id=evaluation_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return EvaluationOut.model_validate(updated, from_attributes=True)


@router.delete("/{evaluation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_evaluation(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete an evaluation."""
    school_id = context.require_any_membership().school_id
    evaluation = await operations.get_evaluation(
        session, evaluation_id=evaluation_id, school_id=school_id
    )
    await _require_teacher_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    await operations.delete_evaluation(session, evaluation_id=evaluation_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------


@router.get("/{evaluation_id}/questions", response_model=list[QuestionOut])
async def list_questions(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID, Path()],
) -> list[QuestionOut]:
    """List the questions of an evaluation.

    A student only sees the questions of a published evaluation.
    """
    school_id = context.require_any_membership().school_id
    evaluation = await operations.get_evaluation(
        session, evaluation_id=evaluation_id, school_id=school_id
    )

    if not await can_read_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    ):
        raise ForbiddenError(
            "You do not have access to this course subject.",
            code="course_subject_forbidden",
        )

    if not evaluation.is_published and context.role_in(school_id) == SchoolRole.STUDENT:
        raise ForbiddenError(
            "This evaluation is not published yet.",
            code="evaluation_unpublished",
        )

    questions = await operations.list_questions(session, evaluation_id=evaluation_id)
    return [QuestionOut.model_validate(q, from_attributes=True) for q in questions]


@router.post(
    "/{evaluation_id}/questions",
    response_model=QuestionOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_question(
    body: QuestionCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID, Path()],
) -> QuestionOut:
    """Add a question to an evaluation."""
    school_id = context.require_any_membership().school_id
    evaluation = await operations.get_evaluation(
        session, evaluation_id=evaluation_id, school_id=school_id
    )
    await _require_teacher_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    question = await operations.create_question(
        session,
        school_id=school_id,
        evaluation_id=evaluation_id,
        kind=body.kind,
        prompt=body.prompt,
        options=body.options,
        points=body.points,
    )
    await session.commit()
    return QuestionOut.model_validate(question, from_attributes=True)


@router.patch(
    "/questions/{question_id}",
    response_model=QuestionOut,
)
async def update_question(
    body: QuestionUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    question_id: Annotated[uuid.UUID, Path()],
) -> QuestionOut:
    """Update a question."""
    school_id = context.require_any_membership().school_id
    question = await operations._get_question(session, question_id=question_id, school_id=school_id)
    evaluation = await operations.get_evaluation(
        session, evaluation_id=question.evaluation_id, school_id=school_id
    )
    await _require_teacher_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    updated = await operations.update_question(
        session,
        question_id=question_id,
        school_id=school_id,
        changes=_changes(body),
    )
    await session.commit()
    return QuestionOut.model_validate(updated, from_attributes=True)


@router.delete(
    "/questions/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_question(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    question_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Delete a question."""
    school_id = context.require_any_membership().school_id
    question = await operations._get_question(session, question_id=question_id, school_id=school_id)
    evaluation = await operations.get_evaluation(
        session, evaluation_id=question.evaluation_id, school_id=school_id
    )
    await _require_teacher_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    await operations.delete_question(session, question_id=question_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Answer keys
# ---------------------------------------------------------------------------


@router.get("/{evaluation_id}/answer-keys", response_model=list[AnswerKeyOut])
async def list_answer_keys(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID, Path()],
) -> list[AnswerKeyOut]:
    """List the answer keys of an evaluation.

    Only the teacher of the course subject and the school admins can
    read them. A student gets a 403.
    """
    school_id = context.require_any_membership().school_id
    evaluation = await operations.get_evaluation(
        session, evaluation_id=evaluation_id, school_id=school_id
    )
    await _require_admin_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    keys = await operations.list_answer_keys(session, evaluation_id=evaluation_id)
    return [AnswerKeyOut.model_validate(k, from_attributes=True) for k in keys]


@router.put(
    "/{evaluation_id}/answer-keys",
    response_model=AnswerKeyOut,
    status_code=status.HTTP_201_CREATED,
)
async def set_answer_key(
    body: AnswerKeyCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID, Path()],
) -> AnswerKeyOut:
    """Set the answer key of a question, replacing the previous one."""
    school_id = context.require_any_membership().school_id
    evaluation = await operations.get_evaluation(
        session, evaluation_id=evaluation_id, school_id=school_id
    )
    await _require_admin_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    # The question has to belong to this evaluation.
    questions = await operations.list_questions(session, evaluation_id=evaluation_id)
    if not any(q.id == body.question_id for q in questions):
        raise NotFoundError("Question not found.")

    key = await operations.set_answer_key(
        session,
        school_id=school_id,
        evaluation_id=evaluation_id,
        question_id=body.question_id,
        closed_answer=body.closed_answer,
        closed_boolean=body.closed_boolean,
        model_answer=body.model_answer,
        points=body.points,
    )
    await session.commit()
    return AnswerKeyOut.model_validate(key, from_attributes=True)


@router.delete(
    "/answer-keys/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_answer_key(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    question_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Remove the answer key of a question."""
    school_id = context.require_any_membership().school_id

    question_result = await session.execute(
        select(EvaluationQuestion).where(
            EvaluationQuestion.id == question_id,
            EvaluationQuestion.school_id == school_id,
        )
    )
    question = question_result.scalar_one_or_none()
    if question is None:
        raise NotFoundError("Question not found.")

    evaluation = await operations.get_evaluation(
        session, evaluation_id=question.evaluation_id, school_id=school_id
    )
    await _require_admin_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    await operations.delete_answer_key(session, question_id=question_id, school_id=school_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------------------------------------------------------------------------
# Attempts
# ---------------------------------------------------------------------------


@router.post(
    "/{evaluation_id}/attempts",
    response_model=AttemptOut,
    status_code=status.HTTP_201_CREATED,
)
async def start_attempt(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID, Path()],
) -> AttemptOut:
    """Start an attempt at an evaluation.

    Idempotent: calling it twice returns the same attempt.
    """
    school_id = context.require_any_membership().school_id
    evaluation = await operations.get_evaluation(
        session, evaluation_id=evaluation_id, school_id=school_id
    )

    if not evaluation.is_published:
        raise ForbiddenError(
            "This evaluation is not published yet.",
            code="evaluation_unpublished",
        )

    if not await can_read_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    ):
        raise ForbiddenError(
            "You do not have access to this course subject.",
            code="course_subject_forbidden",
        )

    attempt = await operations.start_attempt(
        session,
        school_id=school_id,
        evaluation_id=evaluation_id,
        student_id=context.user_id,
    )
    await session.commit()
    return AttemptOut.model_validate(attempt, from_attributes=True)


@router.get("/attempts", response_model=list[AttemptOut])
async def list_attempts(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    evaluation_id: Annotated[uuid.UUID | None, Query()] = None,
    student_id: Annotated[uuid.UUID | None, Query()] = None,
) -> list[AttemptOut]:
    """List the attempts the caller may read."""
    school_id = context.require_any_membership().school_id

    # A student only ever sees their own attempts.
    if context.role_in(school_id) == SchoolRole.STUDENT:
        student_id = context.user_id

    attempts = await operations.list_attempts(
        session,
        school_id=school_id,
        evaluation_id=evaluation_id,
        student_id=student_id,
    )
    return [AttemptOut.model_validate(a, from_attributes=True) for a in attempts]


@router.post(
    "/attempts/{attempt_id}/answers",
    response_model=AnswerOut,
    status_code=status.HTTP_201_CREATED,
)
async def save_answer(
    body: AnswerCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    attempt_id: Annotated[uuid.UUID, Path()],
) -> AnswerOut:
    """Record an answer of the caller.

    Only the student who owns the attempt can answer it.
    """
    school_id = context.require_any_membership().school_id
    attempt = await operations.get_attempt(session, attempt_id=attempt_id, school_id=school_id)

    if attempt.student_id != context.user_id:
        raise ForbiddenError(
            "This attempt belongs to another student.",
            code="attempt_forbidden",
        )

    if attempt.status != EvaluationAttemptStatus.IN_PROGRESS:
        raise ForbiddenError(
            "This attempt is no longer open.",
            code="attempt_closed",
        )

    answer = await operations.save_answer(
        session,
        school_id=school_id,
        attempt_id=attempt_id,
        question_id=body.question_id,
        closed_answer=body.closed_answer,
        closed_boolean=body.closed_boolean,
        text_answer=body.text_answer,
    )
    await session.commit()
    return AnswerOut.model_validate(answer, from_attributes=True)


@router.post("/attempts/{attempt_id}/submit", response_model=AttemptOut)
async def submit_attempt(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    attempt_id: Annotated[uuid.UUID, Path()],
) -> AttemptOut:
    """Submit an attempt.

    The closed questions are scored against the answer keys here, on
    the server: the keys never reach the student. An open question
    still needs a teacher, so the attempt stays in the `submitted`
    state until it is graded.
    """
    school_id = context.require_any_membership().school_id
    attempt = await operations.get_attempt(session, attempt_id=attempt_id, school_id=school_id)

    if attempt.student_id != context.user_id:
        raise ForbiddenError(
            "This attempt belongs to another student.",
            code="attempt_forbidden",
        )

    if attempt.status == EvaluationAttemptStatus.GRADED:
        # Already graded: return the stored score.
        return AttemptOut.model_validate(attempt, from_attributes=True)

    score, max_score = await operations.score_closed_attempt(
        session, attempt_id=attempt_id, school_id=school_id
    )

    attempt.status = EvaluationAttemptStatus.SUBMITTED
    attempt.submitted_at = attempt.submitted_at or datetime.now(UTC)
    attempt.score = score
    attempt.max_score = max_score
    await session.commit()
    return AttemptOut.model_validate(attempt, from_attributes=True)


@router.get("/attempts/{attempt_id}/answers", response_model=list[AnswerOut])
async def list_answers(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    attempt_id: Annotated[uuid.UUID, Path()],
) -> list[AnswerOut]:
    """List the answers of an attempt."""
    school_id = context.require_any_membership().school_id
    attempt = await operations.get_attempt(session, attempt_id=attempt_id, school_id=school_id)

    if attempt.student_id != context.user_id and not await can_read_course_subject(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=(
            await operations.get_evaluation(
                session,
                evaluation_id=attempt.evaluation_id,
                school_id=school_id,
            )
        ).course_subject_id,
    ):
        raise ForbiddenError(
            "You do not have access to this attempt.",
            code="attempt_forbidden",
        )

    answers = await operations.list_answers(session, attempt_id=attempt_id)
    return [AnswerOut.model_validate(a, from_attributes=True) for a in answers]


@router.delete(
    "/attempts/{attempt_id}/answers/{question_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_answer(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    attempt_id: Annotated[uuid.UUID, Path()],
    question_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Clear one answer of the caller's attempt.

    A student who picks the wrong option has to be able to undo it,
    and an open answer that is not wanted anymore has to be removable
    too. Only the owner of the attempt can change it, and only while
    the attempt is open.
    """
    school_id = context.require_any_membership().school_id
    attempt = await operations.get_attempt(session, attempt_id=attempt_id, school_id=school_id)

    if attempt.student_id != context.user_id:
        raise ForbiddenError(
            "This attempt belongs to another student.",
            code="attempt_forbidden",
        )

    if attempt.status != EvaluationAttemptStatus.IN_PROGRESS:
        raise ForbiddenError(
            "This attempt is no longer open.",
            code="attempt_closed",
        )

    await operations.delete_answer(
        session,
        school_id=school_id,
        attempt_id=attempt_id,
        question_id=question_id,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/answers/{answer_id}/grade", response_model=AnswerOut)
async def grade_answer(
    body: GradeAnswerRequest,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    answer_id: Annotated[uuid.UUID, Path()],
) -> AnswerOut:
    """Grade one answer."""
    school_id = context.require_any_membership().school_id

    answer_result = await session.execute(
        select(EvaluationAnswer).where(
            EvaluationAnswer.id == answer_id,
            EvaluationAnswer.school_id == school_id,
        )
    )
    answer = answer_result.scalar_one_or_none()
    if answer is None:
        raise NotFoundError("Answer not found.")

    question_result = await session.execute(
        select(EvaluationQuestion).where(
            EvaluationQuestion.id == answer.question_id,
            EvaluationQuestion.school_id == school_id,
        )
    )
    question = question_result.scalar_one_or_none()
    if question is None:
        raise NotFoundError("Question not found.")

    evaluation = await operations.get_evaluation(
        session, evaluation_id=question.evaluation_id, school_id=school_id
    )
    await _require_admin_access(
        session,
        context=context,
        school_id=school_id,
        course_subject_id=evaluation.course_subject_id,
    )

    graded = await operations.grade_answer(
        session,
        answer_id=answer_id,
        school_id=school_id,
        graded_by=context.user_id,
        points_awarded=body.points_awarded,
        feedback=body.feedback,
    )
    await session.commit()
    return AnswerOut.model_validate(graded, from_attributes=True)


__all__ = ["router"]
