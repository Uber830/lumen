"""Pydantic request/response models for the grades router."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class GradeCreate(BaseModel):
    course_subject_id: uuid.UUID
    student_id: uuid.UUID
    academic_period_id: uuid.UUID
    # The Colombian grading scale: 0 to 5.
    score: Decimal = Field(ge=0, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class GradeUpdate(BaseModel):
    score: Decimal | None = Field(default=None, ge=0, le=5)
    notes: str | None = Field(default=None, max_length=2000)


class GradeOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_subject_id: uuid.UUID
    student_id: uuid.UUID
    academic_period_id: uuid.UUID
    score: Decimal
    notes: str | None
    recorded_by: uuid.UUID | None
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime


class StudentGradeRow(BaseModel):
    """One row of the student grade sheet."""

    course_subject_id: uuid.UUID
    subject_name: str
    subject_area: str | None
    # The score per period, keyed by the period name.
    grades: dict[str, Decimal | None]
    average: Decimal | None


class StudentGradesOut(BaseModel):
    rows: list[StudentGradeRow]
    periods: list[dict[str, str]]


__all__ = [
    "GradeCreate",
    "GradeOut",
    "GradeUpdate",
    "StudentGradeRow",
    "StudentGradesOut",
]
