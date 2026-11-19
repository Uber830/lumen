"""Pydantic request/response models for the notifications router."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.db.enums import NotificationKind


class NotificationOut(BaseModel):
    """One notification, as the frontend renders it."""

    id: uuid.UUID
    school_id: uuid.UUID
    kind: NotificationKind
    title: str
    body: str | None
    link: str | None
    payload: dict[str, object] = Field(default_factory=dict)
    read_at: datetime | None
    created_at: datetime
    updated_at: datetime


class UnreadCountOut(BaseModel):
    """How many notifications the caller has not read yet."""

    unread: int


class MarkAllReadOut(BaseModel):
    """How many notifications the bulk read touched."""

    updated: int


class NotificationPreferenceOut(BaseModel):
    """What the caller wants to be told about one kind of event."""

    kind: NotificationKind
    in_app: bool
    email: bool


class NotificationPreferencesOut(BaseModel):
    """The effective preferences of the caller, one entry per kind."""

    preferences: list[NotificationPreferenceOut]


class NotificationPreferenceChange(BaseModel):
    """A change to one kind of event.

    The channels that are not sent stay as they are.
    """

    kind: NotificationKind
    in_app: bool | None = None
    email: bool | None = None

    @model_validator(mode="after")
    def _at_least_one_channel(self) -> NotificationPreferenceChange:
        if self.in_app is None and self.email is None:
            raise ValueError("a change must mention in_app or email")
        return self


class NotificationPreferencesPatch(BaseModel):
    """The changes to apply, in one call."""

    preferences: list[NotificationPreferenceChange] = Field(min_length=1, max_length=32)


__all__ = [
    "MarkAllReadOut",
    "NotificationOut",
    "NotificationPreferenceChange",
    "NotificationPreferenceOut",
    "NotificationPreferencesOut",
    "NotificationPreferencesPatch",
    "UnreadCountOut",
]
