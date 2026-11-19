"""Academic structure models.

Covers the organizational spine of a school:

- `academic_periods` — the time axis (trimesters, semesters...).
- `courses` — a grade-level group ("10mo A").
- `subjects` — a teaching area ("Matematicas").
- `course_subjects` — the join; the unit a teacher is assigned to and
  a student enrolls against.
- `teacher_assignments` — a teacher teaching a course subject.
- `student_enrollments` — a student enrolled in a course.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at, updated_at
from app.db.enums import AcademicPeriodModality, EnrollmentStatus, pg_enum


class AcademicPeriod(Base):
    """A period defined by the school.

    Exactly one row per school may have `is_current = true`; a partial
    unique index enforces that.
    """

    __tablename__ = "academic_periods"
    __table_args__ = (
        # The period name is unique within a school, not globally.
        UniqueConstraint(
            "school_id",
            "name",
            name="academic_periods_school_name_uq",
        ),
        CheckConstraint("end_date >= start_date", name="academic_periods_dates_ck"),
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
    name: Mapped[str] = mapped_column(Text, nullable=False)
    modality: Mapped[AcademicPeriodModality] = mapped_column(
        pg_enum(AcademicPeriodModality, "academic_period_modality"),
        nullable=False,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    is_current: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class Course(Base):
    """A grade-level group (e.g. "10mo A")."""

    __tablename__ = "courses"
    __table_args__ = (
        # The course name is unique within a school, not globally.
        UniqueConstraint(
            "school_id",
            "name",
            name="courses_school_name_uq",
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
    name: Mapped[str] = mapped_column(Text, nullable=False)
    grade_label: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class Subject(Base):
    """A subject area (e.g. "Matematicas").

    One subject can be taught in many courses.
    """

    __tablename__ = "subjects"
    __table_args__ = (
        # The subject name is unique within a school, not globally.
        UniqueConstraint(
            "school_id",
            "name",
            name="subjects_school_name_uq",
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
    name: Mapped[str] = mapped_column(Text, nullable=False)
    area: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class CourseSubject(Base):
    """A subject offered in a specific course.

    This is the unit assigned to teachers and enrolled by students.
    """

    __tablename__ = "course_subjects"
    __table_args__ = (
        # A subject is offered at most once in a course.
        UniqueConstraint(
            "course_id",
            "subject_id",
            name="course_subjects_course_subject_uq",
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
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class TeacherAssignment(Base):
    """A teacher assigned to teach a specific course subject.

    Unique per (course_subject, teacher).
    """

    __tablename__ = "teacher_assignments"
    __table_args__ = (
        # A teacher is assigned to a course subject at most once.
        UniqueConstraint(
            "course_subject_id",
            "teacher_id",
            name="teacher_assignments_course_subject_teacher_uq",
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
    course_subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.course_subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime] = created_at()
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


class StudentEnrollment(Base):
    """A student enrolled in a course.

    Unique per (course, student). `status` tracks whether the student
    is currently active.
    """

    __tablename__ = "student_enrollments"
    __table_args__ = (
        # A student is enrolled in a course at most once.
        UniqueConstraint(
            "course_id",
            "student_id",
            name="student_enrollments_course_student_uq",
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
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.courses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status: Mapped[EnrollmentStatus] = mapped_column(
        pg_enum(EnrollmentStatus, "enrollment_status"),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
        server_default=text("'active'"),
    )
    enrolled_at: Mapped[datetime] = created_at()
    withdrawn_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()
    updated_at: Mapped[datetime] = updated_at()


__all__ = [
    "AcademicPeriod",
    "Course",
    "CourseSubject",
    "StudentEnrollment",
    "Subject",
    "TeacherAssignment",
]
