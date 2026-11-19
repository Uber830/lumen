"""Pydantic request/response models for the chat router.

A conversation has members. A message belongs to a conversation and
is visible to its members. The rules come from the RLS policies the
migrations declared.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from app.db.enums import ChatConversationKind


class ConversationCreate(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    kind: ChatConversationKind = ChatConversationKind.GROUP
    # The members of a new conversation, besides the creator.
    member_ids: list[uuid.UUID] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("member_ids")
    @classmethod
    def _dedupe(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        """The same member twice is one member."""
        seen: list[uuid.UUID] = []
        for member_id in value:
            if member_id not in seen:
                seen.append(member_id)
        return seen


class ConversationUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=120)


class ConversationOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    created_by: uuid.UUID
    title: str | None
    kind: ChatConversationKind
    created_at: datetime
    updated_at: datetime


class MemberOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    conversation_id: uuid.UUID
    user_id: uuid.UUID
    joined_at: datetime
    last_read_at: datetime
    created_at: datetime
    updated_at: datetime
    # The display data the member list renders.
    full_name: str | None = None
    email: str | None = None


class MessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=10000)

    @field_validator("body")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("body must not be blank")
        return value


class MessageOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    conversation_id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    sent_at: datetime
    edited_at: datetime | None
    created_at: datetime
    updated_at: datetime
    # The display name of the sender, so the UI does not need a second
    # query per message.
    sender_name: str | None = None


__all__ = [
    "ConversationCreate",
    "ConversationOut",
    "ConversationUpdate",
    "MemberOut",
    "MessageCreate",
    "MessageOut",
]
