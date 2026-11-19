"""ICFES models.

- `icfes_questions`           — the question bank.
- `icfes_answer_keys`         — the correct option per question.
- `icfes_simulations`         — an exam assembled from the bank.
- `icfes_simulation_questions` — the ordered question list of a simulation.
- `icfes_attempts`            — a student's run.
- `icfes_answers`             — the chosen option per question.
- `icfes_scores`              — the per-area breakdown of a graded attempt.

`icfes_answer_keys` is restricted to admins and teachers; the student
role cannot read it. The scoring module in app/icfes/scoring.py
consumes it server-side.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, jsonb, updated_at
from app.db.enums import IcfesAttemptStatus, pg_enum


class IcfesQuestion(Base):
    """A question in the ICFES bank.

    `options` always holds exactly four strings, enforced by a check
    constraint in the database.
    """

    __tablename__ = "icfes_questions"
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
    area: Mapped[str] = mapped_column(Text, nullable=False)
    grado: Mapped[str] = mapped_column(Text, nullable=False)
    difficulty: Mapped[str] = mapped_column(Text, nullable=False)
    competencia: Mapped[str | None] = mapped_column(Text, nullable=True)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    reading: Mapped[str | None] = mapped_column(Text, nullable=True)
    options: Mapped[object] = jsonb()
    points: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("1.0"),
        server_default=text("1.0"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class IcfesAnswerKey(Base):
    """The correct option index for an ICFES question.

    The index is 0..3 and points into `icfes_questions.options`.
    """

    __tablename__ = "icfes_answer_keys"
    __table_args__ = (
        UniqueConstraint(
            "question_id",
            name="icfes_answer_keys_question_uq",
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
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.icfes_questions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    correct_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class IcfesSimulation(Base):
    """An exam assembled from the question bank."""

    __tablename__ = "icfes_simulations"
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
    available_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    available_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    is_published: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    randomize_questions: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    randomize_options: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    # The material of the catalog this simulation comes from, when the
    # platform team enabled it for the school.
    material_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.materials.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # The average score of the school. It is null until the simulation
    # is corrected.
    average_score: Mapped[float | None] = mapped_column(Numeric(6, 2), nullable=True)
    # programado, en_correccion or cerrado.
    status: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class IcfesSimulationQuestion(Base):
    """A question included in a simulation, at a given position."""

    __tablename__ = "icfes_simulation_questions"
    __table_args__ = (
        UniqueConstraint(
            "simulation_id",
            "position",
            name="icfes_simulation_questions_position_uq",
        ),
        UniqueConstraint(
            "simulation_id",
            "question_id",
            name="icfes_simulation_questions_question_uq",
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
    simulation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.icfes_simulations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.icfes_questions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = created_at()


class IcfesAttempt(Base):
    """A student's run through a simulation.

    Unique per (simulation, student).
    """

    __tablename__ = "icfes_attempts"
    __table_args__ = (
        UniqueConstraint(
            "simulation_id",
            "student_id",
            name="icfes_attempts_sim_student_uq",
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
    simulation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.icfes_simulations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[IcfesAttemptStatus] = mapped_column(
        pg_enum(IcfesAttemptStatus, "icfes_attempt_status"),
        nullable=False,
        default=IcfesAttemptStatus.IN_PROGRESS,
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
    global_score: Mapped[Decimal | None] = mapped_column(
        Numeric(6, 2),
        nullable=True,
    )
    max_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class IcfesAnswer(Base):
    """The option a student chose for one question of an attempt."""

    __tablename__ = "icfes_answers"
    __table_args__ = (
        UniqueConstraint(
            "attempt_id",
            "question_id",
            name="icfes_answers_attempt_question_uq",
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
        ForeignKey("public.icfes_attempts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.icfes_questions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    chosen_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class IcfesScore(Base):
    """The per-area breakdown of a graded attempt.

    The primary key is the attempt id: one row per area, unique on
    (attempt, area).
    """

    __tablename__ = "icfes_scores"
    __table_args__ = (
        UniqueConstraint(
            "attempt_id",
            "area",
            name="icfes_scores_attempt_area_uq",
        ),
        {"schema": "public"},
    )

    attempt_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.icfes_attempts.id", ondelete="CASCADE"),
        primary_key=True,
    )
    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.schools.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    area: Mapped[str] = mapped_column(Text, nullable=False)
    correct: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    total: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    percent: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
        default=Decimal("0"),
        server_default=text("0"),
    )
    updated_at: Mapped[datetime] = updated_at()


__all__ = [
    "IcfesAnswer",
    "IcfesAnswerKey",
    "IcfesAttempt",
    "IcfesQuestion",
    "IcfesScore",
    "IcfesSimulation",
    "IcfesSimulationQuestion",
]
