"""Academic module: periods, courses, subjects, assignments, enrollments.

- `operations` — the business logic.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.

The authorization rules come from the RLS policies the migrations
declared: reads for any school member, writes for school admins.
"""

from __future__ import annotations

from app.academics.operations import (
    create_course,
    create_course_subject,
    create_period,
    create_student_enrollment,
    create_subject,
    create_teacher_assignment,
    list_course_subjects,
    list_courses,
    list_members,
    list_periods,
    list_student_enrollments,
    list_subjects,
    list_teacher_assignments,
)

__all__ = [
    "create_course",
    "create_course_subject",
    "create_period",
    "create_student_enrollment",
    "create_subject",
    "create_teacher_assignment",
    "list_course_subjects",
    "list_courses",
    "list_members",
    "list_periods",
    "list_student_enrollments",
    "list_subjects",
    "list_teacher_assignments",
]
