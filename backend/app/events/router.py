"""The events of the signed-in user, as a stream.

The browser opens one connection and receives the events of the user:
a new notification, a new message in a conversation. It then asks the
API for what changed, so the stream carries the news and not the data.

The connection is a `text/event-stream`: the browser reconnects on its
own when it drops, and the server says how long to wait before trying
again.
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.core.context import RequestContext
from app.core.events import Event, hub
from app.deps import get_context

router = APIRouter(prefix="/v1/events", tags=["events"])

# How long the client waits before reconnecting, in milliseconds.
RETRY_MS = 3000

# How long the server waits for an event before sending a ping, in
# seconds. The ping keeps the connection alive through the proxies that
# close an idle stream.
PING_SECONDS = 20


def _frame(event_type: str, data: dict[str, object]) -> str:
    """One event of the stream, in the format the browser expects.

    The type travels inside the payload: the client reads it and hands
    the event to whoever listens to that kind of news.
    """
    payload = json.dumps({"type": event_type, **data}, ensure_ascii=False)
    return f"data: {payload}\n\n"


@router.get("")
async def stream_events(
    request: Request,
    context: Annotated[RequestContext, Depends(get_context)],
) -> StreamingResponse:
    """The stream of events of the caller.

    Only the events of the user that opens it are sent: the hub knows
    who is subscribed to what.
    """
    user_id = context.user_id
    queue = hub.subscribe(user_id)

    async def generator() -> AsyncIterator[str]:
        # The client waits before reconnecting when the connection drops.
        yield f"retry: {RETRY_MS}\n\n"
        # The first frame says the stream is alive, so the browser does
        # not think it is still connecting.
        yield _frame("ready", {"user_id": str(user_id)})
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=PING_SECONDS)
                except TimeoutError:
                    # A ping is a comment: the browser ignores it and the
                    # connection stays open.
                    yield ": ping\n\n"
                    continue
                yield _frame(event.type, event.data)
        finally:
            hub.unsubscribe(user_id, queue)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            # The proxies that buffer the response would break the stream.
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/status")
async def stream_status(
    context: Annotated[RequestContext, Depends(get_context)],
) -> dict[str, object]:
    """How many connections the caller has open. For the diagnostics."""
    user_id = context.user_id
    return {"connections": hub.subscriber_count(user_id)}


__all__ = ["Event", "router"]
