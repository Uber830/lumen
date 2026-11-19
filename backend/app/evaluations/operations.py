"""Evaluation operations.

An evaluation is an authored assessment attached to a course subject.
It has questions, answer keys, and the attempts students make on it.

The answer keys never leave the server for a student. That is the
whole reason the attempt lifecycle lives in the backend rather than in
the browser: the scoring happens here, where the keys are.

The rules come from the RLS policies the migrations declared:

- **evaluations**: read by a school admin, the assigned teacher, or an
  enrolled student when the evaluation is published; written by the
  assigned teacher.
- **questions**: the same, but a student only sees the questions of a
  published evaluation.
- **answer keys**: read and written by the assigned teacher and the
  admins only.
- **attempts**: read by the teacher, the admins and the student who
  made it.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, cast

from sqlalchemy import delete, func, select
from sqlalchemy.engine import CursorResult
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import can_read_course_subject
from app.core.context import RequestContext
from app.core.errors import (
    ConflictError,
    NotFoundError,
)
from app.db.enums import EvaluationAttemptStatus, EvaluationKind
from app.db.models import (
    Evaluation,
    EvaluationAnswer,
    EvaluationAnswerKey,
    EvaluationAttempt,
    EvaluationQuestion,
)

# ---------------------------------------------------------------------------
# Evaluations
# ---------------------------------------------------------------------------


async def list_evaluations(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID | None = None,
) -> list[Evaluation]:
    """List the evaluations the caller may read.

    A student only sees the published ones.
    """
    statement = select(Evaluation).where(Evaluation.school_id == school_id)
    if course_subject_id is not None:
        statement = statement.where(Evaluation.course_subject_id == course_subject_id)

    result = await session.execute(statement.order_by(Evaluation.created_at.desc()))
    rows = list(result.scalars().all())

    visible: list[Evaluation] = []
    for evaluation in rows:
        if await can_read_course_subject(
            session,
            context=context,
            school_id=school_id,
            course_subject_id=evaluation.course_subject_id,
        ):
            if not evaluation.is_published and context.role_in(school_id) == "student":
                # A student does not see a draft.
                continue
            visible.append(evaluation)
    return visible


async def get_evaluation(
    session: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
    school_id: uuid.UUID,
) -> Evaluation:
    """Load one evaluation, scoped to the school."""
    result = await session.execute(
        select(Evaluation).where(
            Evaluation.id == evaluation_id,
            Evaluation.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Evaluation not found.")
    return row


async def create_evaluation(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    posted_by: uuid.UUID,
    course_subject_id: uuid.UUID,
    title: str,
    description: str | None,
    duration_minutes: int | None,
    due_at: datetime | None,
    is_published: bool,
) -> Evaluation:
    """Create an evaluation."""
    await _require_course_subject(session, school_id, course_subject_id)

    evaluation = Evaluation(
        id=uuid.uuid4(),
        school_id=school_id,
        course_subject_id=course_subject_id,
        posted_by=posted_by,
        title=title,
        description=description,
        duration_minutes=duration_minutes,
        due_at=due_at,
        is_published=is_published,
    )
    session.add(evaluation)
    await session.flush()
    return evaluation


async def update_evaluation(
    session: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> Evaluation:
    """Apply a partial update to an evaluation."""
    evaluation = await get_evaluation(session, evaluation_id=evaluation_id, school_id=school_id)
    for field, value in changes.items():
        if value is not None:
            setattr(evaluation, field, value)
    await session.flush()
    return evaluation


async def delete_evaluation(
    session: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Delete an evaluation."""
    evaluation = await get_evaluation(session, evaluation_id=evaluation_id, school_id=school_id)
    await session.delete(evaluation)
    await session.flush()


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------


async def list_questions(
    session: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
    include_unpublished: bool = False,
) -> list[EvaluationQuestion]:
    """List the questions of an evaluation, in order."""
    result = await session.execute(
        select(EvaluationQuestion)
        .where(EvaluationQuestion.evaluation_id == evaluation_id)
        .order_by(EvaluationQuestion.position.asc())
    )
    return list(result.scalars().all())


async def create_question(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    evaluation_id: uuid.UUID,
    kind: EvaluationKind,
    prompt: str,
    options: list[str] | None,
    points: Decimal,
) -> EvaluationQuestion:
    """Add a question to an evaluation.

    The position is the next free one, so the order is stable.
    """
    next_position = await _next_position(session, evaluation_id=evaluation_id)

    question = EvaluationQuestion(
        id=uuid.uuid4(),
        school_id=school_id,
        evaluation_id=evaluation_id,
        position=next_position,
        kind=kind,
        prompt=prompt,
        options=options,
        points=points,
    )
    session.add(question)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("That position is already taken.") from exc
    return question


async def _next_position(
    session: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
) -> int:
    """The next free position in an evaluation."""
    result = await session.execute(
        select(func.max(EvaluationQuestion.position)).where(
            EvaluationQuestion.evaluation_id == evaluation_id
        )
    )
    current = result.scalar_one_or_none()
    return int(current or 0) + 1


async def update_question(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    school_id: uuid.UUID,
    changes: dict[str, object],
) -> EvaluationQuestion:
    """Apply a partial update to a question."""
    question = await _get_question(session, question_id=question_id, school_id=school_id)
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
    """Delete a question."""
    question = await _get_question(session, question_id=question_id, school_id=school_id)
    await session.delete(question)
    await session.flush()


async def _get_question(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    school_id: uuid.UUID,
) -> EvaluationQuestion:
    """Load one question, scoped to the school."""
    result = await session.execute(
        select(EvaluationQuestion).where(
            EvaluationQuestion.id == question_id,
            EvaluationQuestion.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Question not found.")
    return row


# ---------------------------------------------------------------------------
# Answer keys
# ---------------------------------------------------------------------------


async def list_answer_keys(
    session: AsyncSession,
    *,
    evaluation_id: uuid.UUID,
) -> list[EvaluationAnswerKey]:
    """List the answer keys of an evaluation."""
    result = await session.execute(
        select(EvaluationAnswerKey).where(EvaluationAnswerKey.evaluation_id == evaluation_id)
    )
    return list(result.scalars().all())


async def set_answer_key(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    evaluation_id: uuid.UUID,
    question_id: uuid.UUID,
    closed_answer: int | None,
    closed_boolean: bool | None,
    model_answer: str | None,
    points: Decimal,
) -> EvaluationAnswerKey:
    """Set the answer key of a question, replacing the previous one.

    There is one key per question.
    """
    existing = await session.execute(
        select(EvaluationAnswerKey).where(EvaluationAnswerKey.question_id == question_id)
    )
    row = existing.scalar_one_or_none()

    if row is not None:
        row.closed_answer = closed_answer
        row.closed_boolean = closed_boolean
        row.model_answer = model_answer
        row.points = points
        await session.flush()
        return row

    key = EvaluationAnswerKey(
        id=uuid.uuid4(),
        school_id=school_id,
        evaluation_id=evaluation_id,
        question_id=question_id,
        closed_answer=closed_answer,
        closed_boolean=closed_boolean,
        model_answer=model_answer,
        points=points,
    )
    session.add(key)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("That question already has an answer key.") from exc
    return key


async def delete_answer_key(
    session: AsyncSession,
    *,
    question_id: uuid.UUID,
    school_id: uuid.UUID,
) -> None:
    """Remove the answer key of a question."""
    result = await session.execute(
        select(EvaluationAnswerKey).where(
            EvaluationAnswerKey.question_id == question_id,
            EvaluationAnswerKey.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Answer key not found.")
    await session.delete(row)
    await session.flush()


# ---------------------------------------------------------------------------
# Attempts
# ---------------------------------------------------------------------------


async def start_attempt(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    evaluation_id: uuid.UUID,
    student_id: uuid.UUID,
) -> EvaluationAttempt:
    """Start an attempt, or return the existing one.

    Idempotent: a student has at most one attempt per evaluation.
    """
    existing = await session.execute(
        select(EvaluationAttempt).where(
            EvaluationAttempt.evaluation_id == evaluation_id,
            EvaluationAttempt.student_id == student_id,
        )
    )
    row = existing.scalar_one_or_none()
    if row is not None:
        return row

    attempt = EvaluationAttempt(
        id=uuid.uuid4(),
        school_id=school_id,
        evaluation_id=evaluation_id,
        student_id=student_id,
        status=EvaluationAttemptStatus.IN_PROGRESS,
    )
    session.add(attempt)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("You already started this evaluation.") from exc
    return attempt


async def get_attempt(
    session: AsyncSession,
    *,
    attempt_id: uuid.UUID,
    school_id: uuid.UUID,
) -> EvaluationAttempt:
    """Load one attempt, scoped to the school."""
    result = await session.execute(
        select(EvaluationAttempt).where(
            EvaluationAttempt.id == attempt_id,
            EvaluationAttempt.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Attempt not found.")
    return row


async def list_attempts(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    evaluation_id: uuid.UUID | None = None,
    student_id: uuid.UUID | None = None,
) -> list[EvaluationAttempt]:
    """List the attempts of an evaluation."""
    statement = select(EvaluationAttempt).where(EvaluationAttempt.school_id == school_id)
    if evaluation_id is not None:
        statement = statement.where(EvaluationAttempt.evaluation_id == evaluation_id)
    if student_id is not None:
        statement = statement.where(EvaluationAttempt.student_id == student_id)

    result = await session.execute(statement.order_by(EvaluationAttempt.started_at.desc()))
    return list(result.scalars().all())


async def delete_answer(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
) -> bool:
    """Clear one answer of an attempt.

    The student may change their mind about a question, so the answer
    has to be removable and not only replaceable. Returns True when a
    row was removed.
    """
    result = await session.execute(
        delete(EvaluationAnswer).where(
            EvaluationAnswer.school_id == school_id,
            EvaluationAnswer.attempt_id == attempt_id,
            EvaluationAnswer.question_id == question_id,
        )
    )
    return bool(cast(CursorResult[Any], result).rowcount)


async def save_answer(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    attempt_id: uuid.UUID,
    question_id: uuid.UUID,
    closed_answer: int | None,
    closed_boolean: bool | None,
    text_answer: str | None,
) -> EvaluationAnswer:
    """Record a student's answer, replacing the previous one."""
    existing = await session.execute(
        select(EvaluationAnswer).where(
            EvaluationAnswer.attempt_id == attempt_id,
            EvaluationAnswer.question_id == question_id,
        )
    )
    row = existing.scalar_one_or_none()

    if row is not None:
        row.closed_answer = closed_answer
        row.closed_boolean = closed_boolean
        row.text_answer = text_answer
        await session.flush()
        return row

    answer = EvaluationAnswer(
        id=uuid.uuid4(),
        school_id=school_id,
        attempt_id=attempt_id,
        question_id=question_id,
        closed_answer=closed_answer,
        closed_boolean=closed_boolean,
        text_answer=text_answer,
    )
    session.add(answer)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("That answer was already recorded.") from exc
    return answer


async def list_answers(
    session: AsyncSession,
    *,
    attempt_id: uuid.UUID,
) -> list[EvaluationAnswer]:
    """List the answers of an attempt."""
    result = await session.execute(
        select(EvaluationAnswer)
        .where(EvaluationAnswer.attempt_id == attempt_id)
        .order_by(EvaluationAnswer.created_at.asc())
    )
    return list(result.scalars().all())


async def grade_answer(
    session: AsyncSession,
    *,
    answer_id: uuid.UUID,
    school_id: uuid.UUID,
    graded_by: uuid.UUID,
    points_awarded: Decimal,
    feedback: str | None,
) -> EvaluationAnswer:
    """Grade one answer."""
    result = await session.execute(
        select(EvaluationAnswer).where(
            EvaluationAnswer.id == answer_id,
            EvaluationAnswer.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Answer not found.")

    row.points_awarded = points_awarded
    row.feedback = feedback
    row.graded_by = graded_by
    row.graded_at = datetime.now(UTC)
    await session.flush()
    return row


async def score_closed_attempt(
    session: AsyncSession,
    *,
    attempt_id: uuid.UUID,
    school_id: uuid.UUID,
) -> tuple[Decimal, Decimal]:
    """Score an attempt against the answer keys.

    Only the closed questions (multiple choice and true/false) can be
    scored automatically. An open question needs a teacher, so it
    counts as zero until it is graded.

    Returns `(score, max_score)`.
    """
    attempt = await get_attempt(session, attempt_id=attempt_id, school_id=school_id)

    keys_result = await session.execute(
        select(EvaluationAnswerKey)
        .join(
            EvaluationQuestion,
            EvaluationQuestion.id == EvaluationAnswerKey.question_id,
        )
        .where(EvaluationQuestion.evaluation_id == attempt.evaluation_id)
    )
    keys = {key.question_id: key for key in keys_result.scalars().all()}

    answers_result = await session.execute(
        select(EvaluationAnswer).where(EvaluationAnswer.attempt_id == attempt_id)
    )
    answers = list(answers_result.scalars().all())

    score = Decimal("0")
    max_score = Decimal("0")

    for question_id, key in keys.items():
        if key.model_answer is not None:
            # An open question: the teacher grades it.
            max_score += key.points
            continue

        max_score += key.points
        answer = next((a for a in answers if a.question_id == question_id), None)
        if answer is None:
            continue

        if (
            key.closed_answer is not None
            and answer.closed_answer == key.closed_answer
            or (key.closed_boolean is not None and answer.closed_boolean == key.closed_boolean)
        ):
            score += key.points

    return score, max_score


# ---------------------------------------------------------------------------
# Shared
# ---------------------------------------------------------------------------


async def _require_course_subject(
    session: AsyncSession,
    school_id: uuid.UUID,
    course_subject_id: uuid.UUID,
) -> object:
    """Load a course subject, scoped to the school."""
    from app.db.models import CourseSubject

    result = await session.execute(
        select(CourseSubject).where(
            CourseSubject.id == course_subject_id,
            CourseSubject.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Course subject not found.")
    return row


__all__ = [
    "create_evaluation",
    "create_question",
    "delete_answer_key",
    "delete_evaluation",
    "delete_question",
    "get_attempt",
    "get_evaluation",
    "grade_answer",
    "list_answer_keys",
    "list_answers",
    "list_attempts",
    "list_evaluations",
    "list_questions",
    "save_answer",
    "score_closed_attempt",
    "set_answer_key",
    "start_attempt",
    "update_evaluation",
    "update_question",
]
