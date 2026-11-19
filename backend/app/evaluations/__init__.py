"""Evaluations module: the authored assessments and their attempts.

- `operations` — the business logic.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.

The answer keys never leave the server for a student. That is why the
attempt lifecycle lives here rather than in the browser.
"""

from __future__ import annotations

from app.evaluations.operations import (
    create_evaluation,
    create_question,
    delete_answer_key,
    delete_evaluation,
    delete_question,
    get_attempt,
    get_evaluation,
    grade_answer,
    list_answer_keys,
    list_answers,
    list_attempts,
    list_evaluations,
    list_questions,
    save_answer,
    score_closed_attempt,
    set_answer_key,
    start_attempt,
    update_evaluation,
    update_question,
)

__all__ = [
    "create_evaluation",
    "create_question",
    "delete_answer_key",
    "delete_evaluation",
    "delete_question",
    "get_attempt",
    "get_evaluation",
    "grade_answer",
    "list_answer_keys",
    "list_answers",
    "list_attempts",
    "list_evaluations",
    "list_questions",
    "save_answer",
    "score_closed_attempt",
    "set_answer_key",
    "start_attempt",
    "update_evaluation",
    "update_question",
]
