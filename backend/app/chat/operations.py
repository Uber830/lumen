"""Chat operations.

The rules come from the RLS policies the migrations declared:

- **conversations**: a school admin sees all of them; a member sees
  the ones they are in; the creator sees the one they made.
- **messages**: a school admin sees all of them; a member sees the
  ones of the conversations they are in. Anyone in the conversation
  can send one.
- **members**: a school admin sees all of them; a member sees the
  ones of their own conversations.

Note that the live delivery is a periodic query on the API.
These operations are the durable record it is built on.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.context import RequestContext
from app.core.errors import ConflictError, NotFoundError
from app.db.enums import ChatConversationKind, SchoolRole
from app.db.models import (
    ChatConversation,
    ChatMember,
    ChatMessage,
    Profile,
    SchoolMembership,
    User,
)
from app.notifications.service import notify_chat_message


async def list_conversations(
    session: AsyncSession,
    *,
    context: RequestContext,
    school_id: uuid.UUID,
) -> list[ChatConversation]:
    """List the conversations the caller may see.

    A school admin sees all of them. Everybody else sees the ones
    they are a member of.
    """
    if context.role_in(school_id) == SchoolRole.SCHOOL_ADMIN:
        result = await session.execute(
            select(ChatConversation)
            .where(ChatConversation.school_id == school_id)
            .order_by(ChatConversation.updated_at.desc())
        )
        return list(result.scalars().all())

    member_result = await session.execute(
        select(ChatMember.conversation_id).where(
            ChatMember.school_id == school_id,
            ChatMember.user_id == context.user_id,
        )
    )
    conversation_ids = list(member_result.scalars().all())

    if not conversation_ids:
        return []

    result = await session.execute(
        select(ChatConversation)
        .where(ChatConversation.id.in_(conversation_ids))
        .order_by(ChatConversation.updated_at.desc())
    )
    return list(result.scalars().all())


async def get_conversation(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    school_id: uuid.UUID,
) -> ChatConversation:
    """Load one conversation, scoped to the school."""
    result = await session.execute(
        select(ChatConversation).where(
            ChatConversation.id == conversation_id,
            ChatConversation.school_id == school_id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise NotFoundError("Conversation not found.")
    return row


async def is_member(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> bool:
    """True when the user is a member of the conversation."""
    result = await session.execute(
        select(ChatMember.id).where(
            ChatMember.conversation_id == conversation_id,
            ChatMember.user_id == user_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def create_conversation(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    created_by: uuid.UUID,
    title: str | None,
    kind: ChatConversationKind,
    member_ids: list[uuid.UUID],
) -> ChatConversation:
    """Create a conversation and add its members.

    The creator is a member too. Every member has to belong to the
    school.
    """
    conversation = ChatConversation(
        id=uuid.uuid4(),
        school_id=school_id,
        created_by=created_by,
        title=title,
        kind=kind,
    )
    session.add(conversation)
    await session.flush()

    # The creator is always a member.
    session.add(
        ChatMember(
            id=uuid.uuid4(),
            school_id=school_id,
            conversation_id=conversation.id,
            user_id=created_by,
            joined_at=datetime.now(UTC),
            last_read_at=datetime.now(UTC),
        )
    )

    for member_id in member_ids:
        if member_id == created_by:
            continue
        await _require_school_member(session, user_id=member_id, school_id=school_id)
        session.add(
            ChatMember(
                id=uuid.uuid4(),
                school_id=school_id,
                conversation_id=conversation.id,
                user_id=member_id,
                joined_at=datetime.now(UTC),
                last_read_at=datetime.now(UTC),
            )
        )

    await session.flush()
    return conversation


async def add_member(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    school_id: uuid.UUID,
    user_id: uuid.UUID,
) -> ChatMember:
    """Add a member to a conversation."""
    await _require_school_member(session, user_id=user_id, school_id=school_id)

    existing = await session.execute(
        select(ChatMember).where(
            ChatMember.conversation_id == conversation_id,
            ChatMember.user_id == user_id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ConflictError("That user is already a member.")

    member = ChatMember(
        id=uuid.uuid4(),
        school_id=school_id,
        conversation_id=conversation_id,
        user_id=user_id,
        joined_at=datetime.now(UTC),
        last_read_at=datetime.now(UTC),
    )
    session.add(member)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("That user is already a member.") from exc
    return member


async def remove_member(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    school_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Remove a member from a conversation."""
    result = await session.execute(
        select(ChatMember).where(
            ChatMember.conversation_id == conversation_id,
            ChatMember.user_id == user_id,
            ChatMember.school_id == school_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise NotFoundError("That user is not a member.")
    await session.delete(member)
    await session.flush()


async def list_members(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
) -> list[tuple[ChatMember, str | None, str | None]]:
    """List the members of a conversation, with their display data."""
    result = await session.execute(
        select(ChatMember, Profile.full_name, User.email)
        .join(Profile, Profile.id == ChatMember.user_id, isouter=True)
        .join(User, User.id == ChatMember.user_id, isouter=True)
        .where(ChatMember.conversation_id == conversation_id)
        .order_by(ChatMember.joined_at.asc())
    )
    return [(row[0], row[1], row[2]) for row in result.all()]


async def list_messages(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    limit: int = 100,
    before: datetime | None = None,
) -> list[ChatMessage]:
    """List the messages of a conversation, newest first."""
    statement = select(ChatMessage).where(ChatMessage.conversation_id == conversation_id)
    if before is not None:
        statement = statement.where(ChatMessage.sent_at < before)
    statement = statement.order_by(ChatMessage.sent_at.desc()).limit(limit)

    result = await session.execute(statement)
    return list(result.scalars().all())


async def send_message(
    session: AsyncSession,
    *,
    school_id: uuid.UUID,
    conversation_id: uuid.UUID,
    sender_id: uuid.UUID,
    body: str,
) -> ChatMessage:
    """Send a message to a conversation."""
    message = ChatMessage(
        id=uuid.uuid4(),
        school_id=school_id,
        conversation_id=conversation_id,
        sender_id=sender_id,
        body=body,
        sent_at=datetime.now(UTC),
    )
    session.add(message)
    await session.flush()

    # The conversation moves to the top of the list.
    conversation_result = await session.execute(
        select(ChatConversation).where(ChatConversation.id == conversation_id)
    )
    conversation = conversation_result.scalar_one_or_none()
    if conversation is not None:
        conversation.updated_at = datetime.now(UTC)

    await session.flush()

    # The other members are told that the message arrived.
    await notify_chat_message(
        session,
        message=message,
        conversation_title=conversation.title if conversation is not None else None,
    )
    return message


async def mark_read(
    session: AsyncSession,
    *,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
) -> None:
    """Move the caller's read marker to now."""
    result = await session.execute(
        select(ChatMember).where(
            ChatMember.conversation_id == conversation_id,
            ChatMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if member is None:
        raise NotFoundError("You are not a member of this conversation.")
    member.last_read_at = datetime.now(UTC)
    await session.flush()


async def sender_names(
    session: AsyncSession,
    *,
    message_ids: list[uuid.UUID],
) -> dict[uuid.UUID, str]:
    """Resolve the display names of the senders."""
    if not message_ids:
        return {}

    result = await session.execute(
        select(User.id, Profile.full_name)
        .join(Profile, Profile.id == User.id, isouter=True)
        .where(User.id.in_(message_ids))
    )
    return {row[0]: (row[1] or "") for row in result.all()}


async def _require_school_member(
    session: AsyncSession,
    *,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
) -> SchoolMembership:
    """Require the user to belong to the school."""
    result = await session.execute(
        select(SchoolMembership).where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise NotFoundError("That user does not belong to this school.")
    return membership


__all__ = [
    "add_member",
    "create_conversation",
    "get_conversation",
    "is_member",
    "list_conversations",
    "list_members",
    "list_messages",
    "mark_read",
    "remove_member",
    "sender_names",
    "send_message",
]
