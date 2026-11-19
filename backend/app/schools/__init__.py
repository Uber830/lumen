"""School operations and endpoints.

- `operations` — the bootstrap flow, the Python port of the
  `bootstrap_school` SQL function.
- `router`    — the HTTP endpoints.
- `schemas`   — the request and response models.
"""

from __future__ import annotations

from app.schools.operations import (
    DEFAULT_TRIAL_DAYS,
    BootstrapError,
    BootstrapResult,
    bootstrap_school,
)

__all__ = [
    "DEFAULT_TRIAL_DAYS",
    "BootstrapError",
    "BootstrapResult",
    "bootstrap_school",
]
