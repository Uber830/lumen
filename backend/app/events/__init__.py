"""The events module: the stream that tells the browser what happened.

- `router` — the endpoint that opens the stream.
"""

from __future__ import annotations

from app.events.router import router

__all__ = ["router"]
