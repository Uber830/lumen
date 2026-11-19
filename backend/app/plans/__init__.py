"""Plans module: the subscription catalog.

- `router` — the HTTP endpoints.
"""

from __future__ import annotations

from app.plans.router import PlanOut, PlanUpdate

__all__ = ["PlanOut", "PlanUpdate"]
