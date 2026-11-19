"""Notifications module: the in-app notifications of each user.

- `operations` — the data access behind the HTTP endpoints.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.
- `service`   — the domain triggers that create the notifications.

A notification belongs to one user and one school. The recipient is
what scopes every read: the caller sees their own notifications and
nobody else's.
"""

from __future__ import annotations

from app.notifications.operations import (
    count_unread,
    dismiss,
    get_notification,
    list_notifications,
    mark_all_read,
    mark_read,
)

__all__ = [
    "count_unread",
    "dismiss",
    "get_notification",
    "list_notifications",
    "mark_all_read",
    "mark_read",
]
