"""The event hub: what the browser is told without asking.

One connection per browser tab carries the events of the user: a new
notification, a new chat message. The client reacts by asking the API
for what changed, so the payload of an event is small: it says **what
happened**, not what it is. The data always comes from the API, which
means a lost event costs a refetch and never an inconsistency.

The hub lives in the process. With more than one worker the events have
to travel between them: Postgres ``LISTEN/NOTIFY`` is the next step, and
the interface of the hub does not change when it arrives.

**The events leave after the commit.** A transaction that rolls back
does not leave a notification behind, so it must not leave an event
behind either. The events are queued in the session and published by
the listener of ``after_commit`` (see ``app/db/session.py``).
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Session

# How many events a subscriber can have waiting. When the queue is full
# the client is behind: it will ask the API for what it missed.
MAX_QUEUE_SIZE = 64

# The key the pending events are kept under in the session.
PENDING_EVENTS_KEY = "pending_events"


@dataclass(frozen=True, slots=True)
class Event:
    """Something that happened, told to the user that has to know."""

    type: str
    data: dict[str, Any] = field(default_factory=dict)


class Hub:
    """The subscribers of the process, by user."""

    def __init__(self) -> None:
        self._subscribers: dict[uuid.UUID, set[asyncio.Queue[Event]]] = {}

    def subscribe(self, user_id: uuid.UUID) -> asyncio.Queue[Event]:
        """Open a queue for a user and return it."""
        queue: asyncio.Queue[Event] = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
        self._subscribers.setdefault(user_id, set()).add(queue)
        return queue

    def unsubscribe(self, user_id: uuid.UUID, queue: asyncio.Queue[Event]) -> None:
        """Close the queue of a user. A queue that is not there is fine."""
        queues = self._subscribers.get(user_id)
        if not queues:
            return
        queues.discard(queue)
        if not queues:
            self._subscribers.pop(user_id, None)

    def publish(self, user_ids: list[uuid.UUID], event: Event) -> int:
        """Tell an event to the subscribers of these users.

        Returns how many subscribers received it. A subscriber whose
        queue is full does not receive it: it is behind, and it will
        resync when it reconnects.
        """
        delivered = 0
        for user_id in user_ids:
            for queue in tuple(self._subscribers.get(user_id, ())):
                try:
                    queue.put_nowait(event)
                except asyncio.QueueFull:
                    continue
                delivered += 1
        return delivered

    def subscriber_count(self, user_id: uuid.UUID) -> int:
        """How many connections a user has open."""
        return len(self._subscribers.get(user_id, ()))


# The hub of the process.
hub = Hub()


def queue_events(
    session: AsyncSession,
    *,
    event: Event,
    user_ids: list[uuid.UUID],
) -> None:
    """Hold an event until the transaction of the session commits.

    The event is published by the listener of ``after_commit``: a
    transaction that rolls back leaves no notification behind, so it must
    not leave an event behind either.
    """
    pending: list[tuple[list[uuid.UUID], Event]] = session.info.setdefault(PENDING_EVENTS_KEY, [])
    pending.append((list(user_ids), event))


def publish_pending(session: Session) -> None:
    """Publish the events a session was holding. Called after the commit."""
    pending: list[tuple[list[uuid.UUID], Event]] = session.info.pop(PENDING_EVENTS_KEY, []) or []
    for user_ids, event in pending:
        hub.publish(user_ids, event)


__all__ = [
    "Event",
    "Hub",
    "hub",
    "publish_pending",
    "queue_events",
]
