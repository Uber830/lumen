"""Notification operations.

The data access behind the HTTP endpoints. Everything here is scoped by
the recipient: a caller only ever reaches their own notifications, so
the queries always filter on `recipient_user_id` and never trust an id
the browser sent.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast

from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.engine import CursorResult
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.db.enums import NotificationKind
from app.db.models import Notification, NotificationPreference

# What a user gets when they have not said otherwise: the notification
# shows up inside the app, and it is not sent by email.
DEFAULT_IN_APP = True
DEFAULT_EMAIL = False


@dataclass(frozen=True, slots=True)
class Preference:
    """What a user wants to be told about one kind of event."""

    kind: NotificationKind
    in_app: bool
    email: bool


async def list_preferences(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
) -> list[Preference]:
    """The effective preferences of a user.

    Every kind is returned, with the defaults filled in: a user who
    never touched a preference still gets a complete answer, and the
    frontend does not have to merge two sources.
    """
    result = await session.execute(
        select(NotificationPreference).where(NotificationPreference.user_id == user_id)
    )
    rows = {row.kind: row for row in result.scalars().all()}

    return [
        Preference(
            kind=kind,
            in_app=rows[kind].in_app if kind in rows else DEFAULT_IN_APP,
            email=rows[kind].email if kind in rows else DEFAULT_EMAIL,
        )
        for kind in NotificationKind
    ]


async def set_preferences(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    changes: list[tuple[NotificationKind, bool | None, bool | None]],
) -> list[Preference]:
    """Apply the changes and return the effective preferences.

    A change that does not mention a channel leaves it alone: turning
    the app notifications off must not turn the email ones on or off.
    """
    for kind, in_app, email in changes:
        values: dict[str, object] = {
            "id": uuid.uuid4(),
            "user_id": user_id,
            "kind": kind,
        }
        update_values: dict[str, object] = {}
        if in_app is not None:
            values["in_app"] = in_app
            update_values["in_app"] = in_app
        if email is not None:
            values["email"] = email
            update_values["email"] = email

        if not update_values:
            continue

        await session.execute(
            pg_insert(NotificationPreference)
            .values(**values)
            .on_conflict_do_update(
                index_elements=[
                    NotificationPreference.user_id,
                    NotificationPreference.kind,
                ],
                set_=update_values,
            )
        )

    return await list_preferences(session, user_id=user_id)


async def list_notifications(
    session: AsyncSession,
    *,
    recipient_user_id: uuid.UUID,
    limit: int = 20,
    unread_only: bool = False,
) -> list[Notification]:
    """List the notifications of a user, newest first."""
    statement = select(Notification).where(Notification.recipient_user_id == recipient_user_id)
    if unread_only:
        statement = statement.where(Notification.read_at.is_(None))

    result = await session.execute(
        statement.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def count_unread(
    session: AsyncSession,
    *,
    recipient_user_id: uuid.UUID,
) -> int:
    """How many notifications the user has not read."""
    result = await session.execute(
        select(func.count(Notification.id)).where(
            Notification.recipient_user_id == recipient_user_id,
            Notification.read_at.is_(None),
        )
    )
    return int(result.scalar_one())


async def get_notification(
    session: AsyncSession,
    *,
    notification_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
) -> Notification:
    """Load one notification of the user.

    A notification that belongs to somebody else is a 404, not a 403:
    the caller should not be able to confirm that the id exists.
    """
    result = await session.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_user_id == recipient_user_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Notification not found.")
    return row


async def mark_read(
    session: AsyncSession,
    *,
    notification_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
) -> Notification:
    """Mark one notification as read.

    Marking an already read notification is not an error: the caller
    gets the same row back.
    """
    notification = await get_notification(
        session,
        notification_id=notification_id,
        recipient_user_id=recipient_user_id,
    )
    if notification.read_at is None:
        notification.read_at = datetime.now(UTC)
        await session.flush()
    return notification


async def mark_all_read(
    session: AsyncSession,
    *,
    recipient_user_id: uuid.UUID,
) -> int:
    """Mark every unread notification of the user as read.

    Returns how many rows changed, so the frontend can tell whether
    there was anything to do.
    """
    result = await session.execute(
        update(Notification)
        .where(
            Notification.recipient_user_id == recipient_user_id,
            Notification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    return int(cast(CursorResult[Any], result).rowcount or 0)


async def dismiss(
    session: AsyncSession,
    *,
    notification_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
) -> None:
    """Delete one notification of the user."""
    notification = await get_notification(
        session,
        notification_id=notification_id,
        recipient_user_id=recipient_user_id,
    )
    await session.delete(notification)
    await session.flush()


__all__ = [
    "DEFAULT_EMAIL",
    "DEFAULT_IN_APP",
    "Preference",
    "count_unread",
    "dismiss",
    "get_notification",
    "list_notifications",
    "list_preferences",
    "mark_all_read",
    "mark_read",
    "set_preferences",
]
