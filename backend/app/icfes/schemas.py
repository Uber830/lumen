"""Pydantic request/response models for the ICFES authoring router.

The ICFES attempt lifecycle (start, submit, score) already lives in
the backend from Phase 1. What is missing is the authoring: the
question bank, the simulations and their answer keys.

The answer keys are restricted, exactly like the evaluation ones.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class QuestionCreate(BaseModel):
    area: str = Field(min_length=1, max_length=60)
    grado: str = Field(min_length=1, max_length=20)
    difficulty: str = Field(min_length=1, max_length=20)
    competencia: str | None = Field(default=None, max_length=60)
    prompt: str = Field(min_length=1, max_length=8000)
    reading: str | None = Field(default=None, max_length=20000)
    # Exactly four options, as the database requires.
    options: list[str] = Field(min_length=4, max_length=4)
    points: Decimal = Field(default=Decimal("1.0"), ge=0)

    @field_validator("options")
    @classmethod
    def _four_options(cls, value: list[str]) -> list[str]:
        if len(value) != 4:
            raise ValueError("an ICFES question needs exactly four options")
        return value


class QuestionUpdate(BaseModel):
    area: str | None = Field(default=None, min_length=1, max_length=60)
    grado: str | None = Field(default=None, min_length=1, max_length=20)
    difficulty: str | None = Field(default=None, min_length=1, max_length=20)
    competencia: str | None = Field(default=None, max_length=60)
    prompt: str | None = Field(default=None, min_length=1, max_length=8000)
    reading: str | None = Field(default=None, max_length=20000)
    options: list[str] | None = Field(default=None, min_length=4, max_length=4)
    points: Decimal | None = Field(default=None, ge=0)


class QuestionOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    area: str
    grado: str
    difficulty: str
    competencia: str | None
    prompt: str
    reading: str | None
    options: list[str]
    points: Decimal
    created_at: datetime
    updated_at: datetime


class AnswerKeyCreate(BaseModel):
    question_id: uuid.UUID
    # The index of the correct option, from 0 to 3.
    correct_index: int = Field(ge=0, le=3)


class AnswerKeyOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    question_id: uuid.UUID
    correct_index: int
    created_at: datetime
    updated_at: datetime


class SimulationCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    course_subject_id: uuid.UUID
    duration_minutes: int | None = Field(default=None, gt=0)
    available_from: datetime | None = None
    available_until: datetime | None = None
    is_published: bool = False
    randomize_questions: bool = False
    randomize_options: bool = False
    # The questions of the simulation, in order.
    question_ids: list[uuid.UUID] = Field(default_factory=list)


class SimulationUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    duration_minutes: int | None = Field(default=None, gt=0)
    available_from: datetime | None = None
    available_until: datetime | None = None
    is_published: bool | None = None
    randomize_questions: bool | None = None
    randomize_options: bool | None = None


class SimulationOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_subject_id: uuid.UUID
    posted_by: uuid.UUID
    title: str
    description: str | None
    duration_minutes: int | None
    available_from: datetime | None
    available_until: datetime | None
    is_published: bool
    randomize_questions: bool
    randomize_options: bool
    created_at: datetime
    updated_at: datetime
    question_count: int = 0


__all__ = [
    "AnswerKeyCreate",
    "AnswerKeyOut",
    "QuestionCreate",
    "QuestionOut",
    "QuestionUpdate",
    "SimulationCreate",
    "SimulationOut",
    "SimulationUpdate",
]
