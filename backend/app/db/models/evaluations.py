"""Evaluation models.

- `evaluations`            — an authored assessment attached to a course subject.
- `evaluation_questions`  — the questions, in order.
- `evaluation_answer_keys` — the correct answers. Never read by a student.
- `evaluation_attempts`    — a student's run through an evaluation.
- `evaluation_answers`     — the student's answers plus the grading.

The answer-key table is the reason the attempt lifecycle lives in the
backend (Phase 3): the student must never receive the keys.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, jsonb, updated_at
from app.db.enums import EvaluationAttemptStatus, EvaluationKind, pg_enum


class Evaluation(Base):
    """An authored assessment attached to a course subject."""

    __tablename__ = "evaluations"
    __table_args__ = ({"schema": "public"},)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    course_subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.course_subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    posted_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class EvaluationQuestion(Base):
    """A question inside an evaluation.

    `options` holds the four choices for multiple_choice and is null
    for the other kinds.
    """

    __tablename__ = "evaluation_questions"
    __table_args__ = (
        UniqueConstraint(
            "evaluation_id",
            "position",
            name="evaluation_questions_position_uq",
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[EvaluationKind] = mapped_column(
        pg_enum(EvaluationKind, "evaluation_kind"),
        nullable=False,
    )
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    # For multiple_choice: array of 4 strings.
    # For true_false / open: ignored.
    options: Mapped[object | None] = jsonb()
    points: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("1.0"),
        server_default=text("1.0"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class EvaluationAnswerKey(Base):
    """The correct answer to a question.

    Exactly one of `closed_answer`, `closed_boolean` or `model_answer`
    is set, depending on the question kind. Students never read this
    table; the backend scores attempts with it.
    """

    __tablename__ = "evaluation_answer_keys"
    __table_args__ = (
        UniqueConstraint(
            "question_id",
            name="evaluation_answer_keys_question_uq",
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.evaluation_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # For multiple_choice: the index in evaluation_questions.options.
    # For true_false: a boolean.
    # For open: a model answer the grader compares against.
    closed_answer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    closed_boolean: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    model_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    points: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("1.0"),
        server_default=text("1.0"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class EvaluationAttempt(Base):
    """A student's run through an evaluation.

    Unique per (evaluation, student). The status drives what the
    student may do: in_progress -> submitted -> graded.
    """

    __tablename__ = "evaluation_attempts"
    __table_args__ = (
        UniqueConstraint(
            "evaluation_id",
            "student_id",
            name="evaluation_attempts_eval_student_uq",
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    evaluation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.evaluations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[EvaluationAttemptStatus] = mapped_column(
        pg_enum(EvaluationAttemptStatus, "evaluation_attempt_status"),
        nullable=False,
        default=EvaluationAttemptStatus.IN_PROGRESS,
        server_default=text("'in_progress'"),
    )
    started_at: Mapped[datetime] = created_at()
    submitted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    graded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    max_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class EvaluationAnswer(Base):
    """A student's answer to one question of an attempt.

    Exactly one of `closed_answer`, `closed_boolean` or `text_answer`
    is set, matching the question kind.
    """

    __tablename__ = "evaluation_answers"
    __table_args__ = (
        UniqueConstraint(
            "attempt_id",
            "question_id",
            name="evaluation_answers_attempt_question_uq",
        ),
        {"schema": "public"},
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.evaluation_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.evaluation_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # For multiple_choice: the chosen option index (or null if skipped).
    # For true_false: the chosen boolean (or null).
    # For open: free text.
    closed_answer: Mapped[int | None] = mapped_column(Integer, nullable=True)
    closed_boolean: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    text_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    points_awarded: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2),
        nullable=True,
    )
    graded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    graded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


__all__ = [
    "Evaluation",
    "EvaluationAnswer",
    "EvaluationAnswerKey",
    "EvaluationAttempt",
    "EvaluationQuestion",
]
