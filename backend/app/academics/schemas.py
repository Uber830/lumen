"""Pydantic request/response models for the academic router.

The field names mirror the database columns, so the frontend's
migration is a matter of swapping the transport rather than
reshaping the data.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, ValidationInfo, field_validator

from app.db.enums import AcademicPeriodModality, EnrollmentStatus

# ---------------------------------------------------------------------------
# Academic periods
# ---------------------------------------------------------------------------


class AcademicPeriodBase(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    modality: AcademicPeriodModality
    start_date: date
    end_date: date
    is_current: bool = False

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value

    @field_validator("end_date")
    @classmethod
    def _check_dates(cls, value: date, info: ValidationInfo) -> date:
        start = info.data.get("start_date")
        if start is not None and value < start:
            raise ValueError("end_date must be on or after start_date")
        return value


class AcademicPeriodCreate(AcademicPeriodBase):
    pass


class AcademicPeriodUpdate(BaseModel):
    """A partial update. Only the fields that are sent are written."""

    name: str | None = Field(default=None, min_length=2, max_length=60)
    modality: AcademicPeriodModality | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None


class AcademicPeriodOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    modality: AcademicPeriodModality
    start_date: date
    end_date: date
    is_current: bool
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Courses
# ---------------------------------------------------------------------------


class CourseBase(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    grade_label: str = Field(min_length=1, max_length=40)

    @field_validator("name", "grade_label")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value


class CourseCreate(CourseBase):
    pass


class CourseUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=60)
    grade_label: str | None = Field(default=None, min_length=1, max_length=40)


class CourseOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    grade_label: str
    created_at: datetime
    updated_at: datetime


class CourseSummary(CourseOut):
    """A course with the counts the UI renders next to it."""

    subject_count: int = 0
    enrolled_students: int = 0
    assigned_teachers: int = 0


# ---------------------------------------------------------------------------
# Subjects
# ---------------------------------------------------------------------------


class SubjectBase(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    area: str | None = Field(default=None, max_length=60)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("name must not be blank")
        return value

    @field_validator("area")
    @classmethod
    def _normalize_area(cls, value: str | None) -> str | None:
        """An empty area is the same as no area."""
        if value is None:
            return None
        value = value.strip()
        return value or None


class SubjectCreate(SubjectBase):
    pass


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=60)
    area: str | None = Field(default=None, max_length=60)


class SubjectOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    name: str
    area: str | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Course subjects
# ---------------------------------------------------------------------------


class CourseSubjectCreate(BaseModel):
    course_id: uuid.UUID
    subject_id: uuid.UUID


class CourseSubjectUpdate(BaseModel):
    course_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None


class CourseSubjectOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_id: uuid.UUID
    subject_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class CourseSubjectSummary(CourseSubjectOut):
    """A course subject with the names the UI renders."""

    course_name: str = ""
    subject_name: str = ""
    subject_area: str | None = None
    assigned_teachers: int = 0


# ---------------------------------------------------------------------------
# Teacher assignments
# ---------------------------------------------------------------------------


class TeacherAssignmentCreate(BaseModel):
    course_subject_id: uuid.UUID
    teacher_id: uuid.UUID


class TeacherAssignmentUpdate(BaseModel):
    course_subject_id: uuid.UUID | None = None
    teacher_id: uuid.UUID | None = None


class TeacherAssignmentOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_subject_id: uuid.UUID
    teacher_id: uuid.UUID
    assigned_at: datetime
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Student enrollments
# ---------------------------------------------------------------------------


class StudentEnrollmentCreate(BaseModel):
    course_id: uuid.UUID
    student_id: uuid.UUID
    status: EnrollmentStatus = EnrollmentStatus.ACTIVE


class StudentEnrollmentUpdate(BaseModel):
    course_id: uuid.UUID | None = None
    student_id: uuid.UUID | None = None
    status: EnrollmentStatus | None = None


class StudentEnrollmentOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_id: uuid.UUID
    student_id: uuid.UUID
    status: EnrollmentStatus
    enrolled_at: datetime
    withdrawn_at: datetime | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Members
# ---------------------------------------------------------------------------


class SchoolMemberOut(BaseModel):
    """A member of a school, joined with their profile.

    The frontend used to build this with a PostgREST join. It is a
    server-side join now, so the browser does one request instead of
    two.
    """

    membership_id: uuid.UUID
    school_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    is_primary: bool
    joined_at: datetime
    full_name: str
    email: str | None = None
    phone: str | None = None
    # The profile picture, when the member has one. The lists show it
    # instead of a generic icon.
    avatar_url: str | None = None
    # When the membership was revoked (deactivated), or None when active.
    revoked_at: datetime | None = None
    # True once the user has set a password; an invited user who never
    # redeemed their activation link has no password yet.
    account_activated: bool = True


class StudentTeacherOut(BaseModel):
    """A teacher of one of the student's own courses.

    A student gets the teachers they actually have, not the staff
    directory of the school.
    """

    user_id: uuid.UUID
    full_name: str
    email: str | None = None
    subjects: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Study plan
# ---------------------------------------------------------------------------


class StudyPlanOut(BaseModel):
    """One grade of the study plan, with the state of the school."""

    course_name: str
    grade_label: str
    subjects: list[str] = Field(default_factory=list)
    subject_count: int = 0
    enrolled_students: int = 0
    exists: bool = False


class StudyPlanImport(BaseModel):
    """The grades of the plan the admin picked."""

    courses: list[str] = Field(min_length=1)


class StudyPlanImportOut(BaseModel):
    """What the import did."""

    created_courses: list[str] = Field(default_factory=list)
    skipped_courses: list[str] = Field(default_factory=list)
    created_subjects: int = 0
    offered_subjects: int = 0


__all__ = [
    "AcademicPeriodCreate",
    "AcademicPeriodOut",
    "AcademicPeriodUpdate",
    "CourseCreate",
    "CourseOut",
    "CourseSubjectCreate",
    "CourseSubjectOut",
    "CourseSubjectSummary",
    "CourseSubjectUpdate",
    "CourseSummary",
    "CourseUpdate",
    "SchoolMemberOut",
    "StudentEnrollmentCreate",
    "StudentEnrollmentOut",
    "StudentEnrollmentUpdate",
    "StudentTeacherOut",
    "StudyPlanImport",
    "StudyPlanImportOut",
    "StudyPlanOut",
    "SubjectCreate",
    "SubjectOut",
    "SubjectUpdate",
    "TeacherAssignmentCreate",
    "TeacherAssignmentOut",
    "TeacherAssignmentUpdate",
]
