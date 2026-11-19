"""Pydantic request/response models for the tasks router."""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.db.enums import TaskSubmissionStatus


class TaskBase(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    course_subject_id: uuid.UUID
    due_at: datetime | None = None
    max_score: Decimal | None = Field(default=None, ge=0, le=1000)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @field_validator("description")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    course_subject_id: uuid.UUID | None = None
    due_at: datetime | None = None
    max_score: Decimal | None = Field(default=None, ge=0, le=1000)


class TaskOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_subject_id: uuid.UUID
    posted_by: uuid.UUID
    title: str
    description: str | None
    due_at: datetime | None
    max_score: Decimal | None
    created_at: datetime
    updated_at: datetime


class TaskSummary(TaskOut):
    """A task with the counts the UI renders next to it."""

    course_subject_label: str = ""
    pending_submissions: int = 0
    total_submissions: int = 0


class SubmissionBase(BaseModel):
    body: str | None = Field(default=None, max_length=20000)
    file_path: str | None = Field(default=None, max_length=1024)
    status: TaskSubmissionStatus = TaskSubmissionStatus.DRAFT

    @field_validator("body", "file_path")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def _check_shape(self) -> SubmissionBase:
        """The status and the timestamps have to agree.

        This mirrors the `task_submissions_consistency_check` constraint
        the migrations declare.
        """
        if self.status == TaskSubmissionStatus.SUBMITTED and not (self.body or self.file_path):
            raise ValueError("a submission needs a body or a file before it can be submitted")
        return self


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(BaseModel):
    """A partial update.

    A student editing their own submission can change the body, the
    file and the status. A teacher grading it sets the grade, the
    feedback and the status.
    """

    body: str | None = Field(default=None, max_length=20000)
    file_path: str | None = Field(default=None, max_length=1024)
    status: TaskSubmissionStatus | None = None
    grade: Decimal | None = Field(default=None, ge=0)
    feedback: str | None = Field(default=None, max_length=2000)


class SubmissionOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    task_id: uuid.UUID
    student_id: uuid.UUID
    body: str | None
    file_path: str | None
    status: TaskSubmissionStatus
    submitted_at: datetime | None
    grade: Decimal | None
    feedback: str | None
    graded_by: uuid.UUID | None
    graded_at: datetime | None
    created_at: datetime
    updated_at: datetime


__all__ = [
    "SubmissionCreate",
    "SubmissionOut",
    "SubmissionUpdate",
    "TaskCreate",
    "TaskOut",
    "TaskSummary",
    "TaskUpdate",
]
