"""The event stream: what the browser is told without asking.

Three things are checked here:

- the stream needs a session, like every other endpoint;
- an event reaches the subscribers of the user it is for, and nobody
  else;
- an event only leaves when the transaction behind it commits: a
  transaction that rolls back leaves no notification behind, so it must
  not leave an event behind either.
"""

from __future__ import annotations

import asyncio
import uuid

import pytest

from app.core.events import Event, Hub, hub, queue_events

pytestmark = pytest.mark.usefixtures("cleanup_users")


def _auth() -> dict[str, str]:
    from tests.conftest import mint_token

    return {"Authorization": f"Bearer {mint_token()}"}


# ---------------------------------------------------------------------------
# The hub
# ---------------------------------------------------------------------------


async def test_an_event_reaches_the_subscriber_of_the_user():
    """The queue of the user gets what is published for them."""
    local = Hub()
    user_id = uuid.uuid4()
    queue = local.subscribe(user_id)

    delivered = local.publish([user_id], Event("notification", {"kind": "chat_message"}))

    assert delivered == 1
    event = await asyncio.wait_for(queue.get(), timeout=1)
    assert event.type == "notification"
    assert event.data["kind"] == "chat_message"


async def test_an_event_does_not_reach_another_user():
    """The news of a user does not travel to the others."""
    local = Hub()
    mine = uuid.uuid4()
    other = uuid.uuid4()
    my_queue = local.subscribe(mine)
    other_queue = local.subscribe(other)

    local.publish([other], Event("notification"))

    assert my_queue.empty()
    assert not other_queue.empty()


async def test_a_subscriber_that_leaves_does_not_receive_events():
    """The queue is closed with the connection."""
    local = Hub()
    user_id = uuid.uuid4()
    queue = local.subscribe(user_id)
    local.unsubscribe(user_id, queue)

    delivered = local.publish([user_id], Event("notification"))

    assert delivered == 0
    assert local.subscriber_count(user_id) == 0


async def test_the_queue_of_a_slow_subscriber_does_not_block_the_others():
    """A subscriber that is behind does not stop the stream."""
    from app.core.events import MAX_QUEUE_SIZE

    local = Hub()
    slow = uuid.uuid4()
    fast = uuid.uuid4()
    slow_queue = local.subscribe(slow)
    fast_queue = local.subscribe(fast)

    for index in range(MAX_QUEUE_SIZE + 10):
        local.publish([slow], Event("notification", {"n": index}))
    local.publish([fast], Event("notification"))

    assert slow_queue.qsize() == MAX_QUEUE_SIZE
    assert not fast_queue.empty()


# ---------------------------------------------------------------------------
# The events and the transaction
# ---------------------------------------------------------------------------


async def test_an_event_waits_for_the_commit(session_factory):
    """The event leaves when the data behind it is on disk."""
    user_id = uuid.uuid4()
    queue = hub.subscribe(user_id)

    async with session_factory() as session:
        queue_events(session, event=Event("notification"), user_ids=[user_id])
        # Nothing has been written yet, so nothing is told yet.
        assert queue.empty()
        await session.commit()

    event = await asyncio.wait_for(queue.get(), timeout=1)
    assert event.type == "notification"

    hub.unsubscribe(user_id, queue)


async def test_a_rolled_back_transaction_leaves_no_event(session_factory):
    """A notification that was not written is not announced."""
    user_id = uuid.uuid4()
    queue = hub.subscribe(user_id)

    async with session_factory() as session:
        queue_events(session, event=Event("notification"), user_ids=[user_id])
        await session.rollback()

    assert queue.empty()
    hub.unsubscribe(user_id, queue)


# ---------------------------------------------------------------------------
# The endpoint
# ---------------------------------------------------------------------------


def test_the_stream_needs_a_session(client):
    """Without a session there is no stream."""
    response = client.get("/v1/events")
    assert response.status_code == 401, response.text


def test_the_status_tells_how_many_connections_are_open(client):
    """The caller can ask how many streams they have open."""
    response = client.get("/v1/events/status", headers=_auth())
    assert response.status_code == 200, response.text
    assert "connections" in response.json()
