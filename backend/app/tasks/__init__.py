"""Tasks module: the assignments and their submissions.

- `operations` — the business logic.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.

The authorization is per course subject, with the extra rules that
apply to a submission: a student owns theirs, a teacher grades them.
"""

from __future__ import annotations

from app.tasks.operations import (
    create_submission,
    create_task,
    delete_submission,
    delete_task,
    get_submission,
    get_task,
    list_submissions,
    list_tasks,
    task_submission_counts,
    update_submission,
    update_task,
)

__all__ = [
    "create_submission",
    "create_task",
    "delete_submission",
    "delete_task",
    "get_submission",
    "get_task",
    "list_submissions",
    "list_tasks",
    "task_submission_counts",
    "update_submission",
    "update_task",
]
