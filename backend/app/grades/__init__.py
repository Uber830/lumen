"""Grades module: the scores a teacher records and a student reads.

- `operations` — the business logic.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.
"""

from __future__ import annotations

from app.grades.operations import (
    delete_grade,
    get_grade,
    list_grades,
    record_grade,
    student_grade_sheet,
    update_grade,
)

__all__ = [
    "delete_grade",
    "get_grade",
    "list_grades",
    "record_grade",
    "student_grade_sheet",
    "update_grade",
]
