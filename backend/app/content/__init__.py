"""Content module: the material a teacher posts to a course subject.

- `operations` — the business logic.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.

The authorization is per course subject: see `app/core/access.py`.
"""

from __future__ import annotations

from app.content.operations import (
    create_content_item,
    delete_content_item,
    get_content_item,
    list_content_items,
    list_progress,
    mark_completed,
    unmark_completed,
    update_content_item,
)

__all__ = [
    "create_content_item",
    "delete_content_item",
    "get_content_item",
    "list_content_items",
    "list_progress",
    "mark_completed",
    "unmark_completed",
    "update_content_item",
]
