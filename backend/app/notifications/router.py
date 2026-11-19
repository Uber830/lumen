"""Notifications router: the in-app notifications of the caller.

Every route is scoped by the recipient: the browser never says whose
notifications it wants, it only says whether it wants the unread ones
and how many. A notification that belongs to somebody else is a 404,
not a 403, so the ids of the other tenants cannot be probed.

The rows themselves are written by the domain modules (a task is
posted, a submission is graded, a chat message is sent); see
`app.notifications.service`.
"""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.db.session import get_db
from app.deps import get_context
from app.notifications import operations
from app.notifications.schemas import (
    MarkAllReadOut,
    NotificationOut,
    NotificationPreferenceOut,
    NotificationPreferencesOut,
    NotificationPreferencesPatch,
    UnreadCountOut,
)

router = APIRouter(prefix="/v1/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    unread_only: Annotated[bool, Query()] = False,
) -> list[NotificationOut]:
    """List the caller's notifications, newest first."""
    rows = await operations.list_notifications(
        session,
        recipient_user_id=context.user_id,
        limit=limit,
        unread_only=unread_only,
    )
    return [NotificationOut.model_validate(row, from_attributes=True) for row in rows]


@router.get("/preferences", response_model=NotificationPreferencesOut)
async def get_preferences(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> NotificationPreferencesOut:
    """What the caller wants to be told about, and how.

    Every kind is returned, with the defaults filled in for the ones
    the caller never touched.
    """
    preferences = await operations.list_preferences(session, user_id=context.user_id)
    return NotificationPreferencesOut(
        preferences=[
            NotificationPreferenceOut(
                kind=preference.kind,
                in_app=preference.in_app,
                email=preference.email,
            )
            for preference in preferences
        ]
    )


@router.patch("/preferences", response_model=NotificationPreferencesOut)
async def update_preferences(
    body: NotificationPreferencesPatch,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> NotificationPreferencesOut:
    """Change what the caller wants to be told about.

    Only the channels that are sent are changed: turning the app
    notifications off leaves the email ones alone.
    """
    preferences = await operations.set_preferences(
        session,
        user_id=context.user_id,
        changes=[(change.kind, change.in_app, change.email) for change in body.preferences],
    )
    await session.commit()
    return NotificationPreferencesOut(
        preferences=[
            NotificationPreferenceOut(
                kind=preference.kind,
                in_app=preference.in_app,
                email=preference.email,
            )
            for preference in preferences
        ]
    )


@router.get("/unread-count", response_model=UnreadCountOut)
async def unread_count(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> UnreadCountOut:
    """How many notifications the caller has not read.

    The bell shows this number, so it is the endpoint the frontend
    polls.
    """
    unread = await operations.count_unread(session, recipient_user_id=context.user_id)
    return UnreadCountOut(unread=unread)


@router.post("/{notification_id}/read", response_model=NotificationOut)
async def mark_read(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    notification_id: Annotated[uuid.UUID, Path()],
) -> NotificationOut:
    """Mark one notification as read."""
    notification = await operations.mark_read(
        session,
        notification_id=notification_id,
        recipient_user_id=context.user_id,
    )
    await session.commit()
    return NotificationOut.model_validate(notification, from_attributes=True)


@router.post("/read-all", response_model=MarkAllReadOut)
async def mark_all_read(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> MarkAllReadOut:
    """Mark every unread notification of the caller as read."""
    updated = await operations.mark_all_read(session, recipient_user_id=context.user_id)
    await session.commit()
    return MarkAllReadOut(updated=updated)


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    notification_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Dismiss one notification: it is removed for good."""
    await operations.dismiss(
        session,
        notification_id=notification_id,
        recipient_user_id=context.user_id,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
