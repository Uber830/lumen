"""Chat router: the conversations and their messages.

A conversation is visible to its members. A message belongs to a
conversation and is visible to the same people.

The Realtime delivery stays on Supabase's Realtime service; these
endpoints are the durable record it is built on.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Response, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.chat import operations
from app.chat.schemas import (
    ConversationCreate,
    ConversationOut,
    ConversationUpdate,
    MemberOut,
    MessageCreate,
    MessageOut,
)
from app.core.context import RequestContext
from app.core.errors import ForbiddenError
from app.db.enums import SchoolRole
from app.db.session import get_db
from app.deps import get_context

router = APIRouter(prefix="/v1/chat", tags=["chat"])


def _changes(body: BaseModel) -> dict[str, object]:
    return body.model_dump(exclude_unset=True)


async def _require_access(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
    conversation_id: uuid.UUID,
) -> None:
    """Require the caller to be a member of the conversation, or an admin."""
    if context.role_in(school_id) == SchoolRole.SCHOOL_ADMIN:
        return
    if not await operations.is_member(
        session, conversation_id=conversation_id, user_id=context.user_id
    ):
        raise ForbiddenError(
            "You are not a member of this conversation.",
            code="conversation_forbidden",
        )


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> list[ConversationOut]:
    """List the conversations the caller may see."""
    school_id = context.require_any_membership().school_id
    conversations = await operations.list_conversations(
        session, context=context, school_id=school_id
    )
    return [ConversationOut.model_validate(c, from_attributes=True) for c in conversations]


@router.post(
    "/conversations",
    response_model=ConversationOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_conversation(
    body: ConversationCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
) -> ConversationOut:
    """Create a conversation.

    The creator is a member of it, along with anyone in `member_ids`.
    """
    school_id = context.require_any_membership().school_id

    conversation = await operations.create_conversation(
        session,
        school_id=school_id,
        created_by=context.user_id,
        title=body.title,
        kind=body.kind,
        member_ids=body.member_ids,
    )
    await session.commit()
    return ConversationOut.model_validate(conversation, from_attributes=True)


@router.patch("/conversations/{conversation_id}", response_model=ConversationOut)
async def update_conversation(
    body: ConversationUpdate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    conversation_id: Annotated[uuid.UUID, Path()],
) -> ConversationOut:
    """Rename a conversation."""
    school_id = context.require_any_membership().school_id
    conversation = await operations.get_conversation(
        session, conversation_id=conversation_id, school_id=school_id
    )
    await _require_access(
        session, context=context, school_id=school_id, conversation_id=conversation_id
    )

    changes = _changes(body)
    for field, value in changes.items():
        if value is not None:
            setattr(conversation, field, value)
    await session.commit()
    return ConversationOut.model_validate(conversation, from_attributes=True)


@router.get("/conversations/{conversation_id}/members", response_model=list[MemberOut])
async def list_members(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    conversation_id: Annotated[uuid.UUID, Path()],
) -> list[MemberOut]:
    """List the members of a conversation."""
    school_id = context.require_any_membership().school_id
    await operations.get_conversation(session, conversation_id=conversation_id, school_id=school_id)
    await _require_access(
        session, context=context, school_id=school_id, conversation_id=conversation_id
    )

    rows = await operations.list_members(session, conversation_id=conversation_id)
    return [
        MemberOut(
            id=member.id,
            school_id=member.school_id,
            conversation_id=member.conversation_id,
            user_id=member.user_id,
            joined_at=member.joined_at,
            last_read_at=member.last_read_at,
            created_at=member.created_at,
            updated_at=member.updated_at,
            full_name=full_name,
            email=email,
        )
        for member, full_name, email in rows
    ]


@router.post(
    "/conversations/{conversation_id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_member(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    conversation_id: Annotated[uuid.UUID, Path()],
    user_id: Annotated[uuid.UUID, Query()],
) -> MemberOut:
    """Add a member to a conversation."""
    school_id = context.require_any_membership().school_id
    await operations.get_conversation(session, conversation_id=conversation_id, school_id=school_id)
    await _require_access(
        session, context=context, school_id=school_id, conversation_id=conversation_id
    )

    member = await operations.add_member(
        session,
        conversation_id=conversation_id,
        school_id=school_id,
        user_id=user_id,
    )
    await session.commit()
    return MemberOut.model_validate(member, from_attributes=True)


@router.delete(
    "/conversations/{conversation_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def remove_member(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    conversation_id: Annotated[uuid.UUID, Path()],
    user_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Remove a member from a conversation."""
    school_id = context.require_any_membership().school_id
    await operations.get_conversation(session, conversation_id=conversation_id, school_id=school_id)
    await _require_access(
        session, context=context, school_id=school_id, conversation_id=conversation_id
    )

    await operations.remove_member(
        session,
        conversation_id=conversation_id,
        school_id=school_id,
        user_id=user_id,
    )
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
async def list_messages(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    conversation_id: Annotated[uuid.UUID, Path()],
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    before: Annotated[datetime | None, Query()] = None,
) -> list[MessageOut]:
    """List the messages of a conversation, newest first."""
    school_id = context.require_any_membership().school_id
    await operations.get_conversation(session, conversation_id=conversation_id, school_id=school_id)
    await _require_access(
        session, context=context, school_id=school_id, conversation_id=conversation_id
    )

    messages = await operations.list_messages(
        session, conversation_id=conversation_id, limit=limit, before=before
    )
    names = await operations.sender_names(
        session, message_ids=[message.sender_id for message in messages]
    )
    return [
        MessageOut(
            id=message.id,
            school_id=message.school_id,
            conversation_id=message.conversation_id,
            sender_id=message.sender_id,
            body=message.body,
            sent_at=message.sent_at,
            edited_at=message.edited_at,
            created_at=message.created_at,
            updated_at=message.updated_at,
            sender_name=names.get(message.sender_id),
        )
        for message in messages
    ]


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageOut,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    body: MessageCreate,
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    conversation_id: Annotated[uuid.UUID, Path()],
) -> MessageOut:
    """Send a message to a conversation."""
    school_id = context.require_any_membership().school_id
    await operations.get_conversation(session, conversation_id=conversation_id, school_id=school_id)
    await _require_access(
        session, context=context, school_id=school_id, conversation_id=conversation_id
    )

    message = await operations.send_message(
        session,
        school_id=school_id,
        conversation_id=conversation_id,
        sender_id=context.user_id,
        body=body.body,
    )
    await session.commit()

    names = await operations.sender_names(session, message_ids=[message.sender_id])
    return MessageOut(
        id=message.id,
        school_id=message.school_id,
        conversation_id=message.conversation_id,
        sender_id=message.sender_id,
        body=message.body,
        sent_at=message.sent_at,
        edited_at=message.edited_at,
        created_at=message.created_at,
        updated_at=message.updated_at,
        sender_name=names.get(message.sender_id),
    )


@router.post("/conversations/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    context: Annotated[RequestContext, Depends(get_context)],
    session: Annotated[AsyncSession, Depends(get_db)],
    conversation_id: Annotated[uuid.UUID, Path()],
) -> Response:
    """Move the caller's read marker to now."""
    school_id = context.require_any_membership().school_id
    await operations.get_conversation(session, conversation_id=conversation_id, school_id=school_id)

    await operations.mark_read(session, conversation_id=conversation_id, user_id=context.user_id)
    await session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
