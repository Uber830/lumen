"""Pydantic request/response models for the evaluations router.

The answer key is a separate model from the question: the student
never receives it. The response models for the question never carry
the key, and the key has its own endpoints, restricted to the
teacher and the admins.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator

from app.db.enums import EvaluationAttemptStatus, EvaluationKind

# ---------------------------------------------------------------------------
# Evaluations
# ---------------------------------------------------------------------------


class EvaluationCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    course_subject_id: uuid.UUID
    duration_minutes: int | None = Field(default=None, gt=0)
    due_at: datetime | None = None
    is_published: bool = False


class EvaluationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    duration_minutes: int | None = Field(default=None, gt=0)
    due_at: datetime | None = None
    is_published: bool | None = None


class EvaluationOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_subject_id: uuid.UUID
    posted_by: uuid.UUID
    title: str
    description: str | None
    duration_minutes: int | None
    due_at: datetime | None
    is_published: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------


class QuestionCreate(BaseModel):
    kind: EvaluationKind
    prompt: str = Field(min_length=1, max_length=4000)
    # The four options of a multiple-choice question.
    options: list[str] | None = None
    points: Decimal = Field(default=Decimal("1.0"), ge=0)

    @model_validator(mode="after")
    def _check_options(self) -> QuestionCreate:
        """A multiple-choice question needs at least two options."""
        if self.kind == EvaluationKind.MULTIPLE_CHOICE and (
            not self.options or len(self.options) < 2
        ):
            raise ValueError("a multiple_choice question needs at least two options")
        return self


class QuestionUpdate(BaseModel):
    prompt: str | None = Field(default=None, min_length=1, max_length=4000)
    options: list[str] | None = None
    points: Decimal | None = Field(default=None, ge=0)


class QuestionOut(BaseModel):
    """A question as the student receives it: never the answer."""

    id: uuid.UUID
    school_id: uuid.UUID
    evaluation_id: uuid.UUID
    position: int
    kind: EvaluationKind
    prompt: str
    options: list[str] | None
    points: Decimal
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Answer keys
# ---------------------------------------------------------------------------


class AnswerKeyCreate(BaseModel):
    question_id: uuid.UUID
    # The index of the correct option, for a multiple-choice question.
    closed_answer: int | None = Field(default=None, ge=0)
    # The correct value, for a true/false question.
    closed_boolean: bool | None = None
    # The expected answer, for an open question.
    model_answer: str | None = Field(default=None, max_length=4000)
    points: Decimal = Field(default=Decimal("1.0"), ge=0)

    @model_validator(mode="after")
    def _check_exactly_one(self) -> AnswerKeyCreate:
        """Exactly one of the three shapes is set.

        This mirrors the `evaluation_answer_keys_shape_ck` constraint
        the migrations declare.
        """
        given = [
            self.closed_answer is not None,
            self.closed_boolean is not None,
            self.model_answer is not None,
        ]
        if sum(given) != 1:
            raise ValueError(
                "exactly one of closed_answer, closed_boolean or model_answer must be set"
            )
        return self


class AnswerKeyOut(BaseModel):
    """An answer key. Only the teacher and the admins ever see it."""

    id: uuid.UUID
    school_id: uuid.UUID
    evaluation_id: uuid.UUID
    question_id: uuid.UUID
    closed_answer: int | None
    closed_boolean: bool | None
    model_answer: str | None
    points: Decimal
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Attempts
# ---------------------------------------------------------------------------


class AnswerCreate(BaseModel):
    question_id: uuid.UUID
    closed_answer: int | None = Field(default=None, ge=0)
    closed_boolean: bool | None = None
    text_answer: str | None = Field(default=None, max_length=20000)

    @model_validator(mode="after")
    def _check_exactly_one(self) -> AnswerCreate:
        """Exactly one of the three shapes is set."""
        given = [
            self.closed_answer is not None,
            self.closed_boolean is not None,
            self.text_answer is not None,
        ]
        if sum(given) != 1:
            raise ValueError(
                "exactly one of closed_answer, closed_boolean or text_answer must be set"
            )
        return self


class AttemptOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    evaluation_id: uuid.UUID
    student_id: uuid.UUID
    status: EvaluationAttemptStatus
    started_at: datetime
    submitted_at: datetime | None
    graded_at: datetime | None
    score: Decimal | None
    max_score: Decimal | None
    created_at: datetime
    updated_at: datetime


class AnswerOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    attempt_id: uuid.UUID
    question_id: uuid.UUID
    closed_answer: int | None
    closed_boolean: bool | None
    text_answer: str | None
    points_awarded: Decimal | None
    graded_by: uuid.UUID | None
    graded_at: datetime | None
    feedback: str | None
    created_at: datetime
    updated_at: datetime


class GradeAnswerRequest(BaseModel):
    """The teacher's grading of one answer."""

    points_awarded: Decimal = Field(ge=0)
    feedback: str | None = Field(default=None, max_length=2000)


__all__ = [
    "AnswerCreate",
    "AnswerKeyCreate",
    "AnswerKeyOut",
    "AnswerOut",
    "AttemptOut",
    "EvaluationCreate",
    "EvaluationOut",
    "EvaluationUpdate",
    "GradeAnswerRequest",
    "QuestionCreate",
    "QuestionOut",
    "QuestionUpdate",
]
