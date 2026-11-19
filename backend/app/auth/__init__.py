"""Authentication: identity verification, operations and endpoints.

- `dependencies` — the JWT verification and the `get_current_user`
  dependency. This module proves identity; it does not authorize.
- `operations`   — the business logic: creating accounts, authenticating,
  issuing and rotating sessions, the password-reset flow.
- `router`       — the HTTP endpoints.
- `schemas`      — the request and response models.

The backend is the only issuer of tokens. There is no legacy path:
a token that was not signed by this backend is not accepted.
"""

from __future__ import annotations

from app.auth.dependencies import (
    CurrentUser,
    get_current_user,
    verify_access_token,
)

__all__ = [
    "CurrentUser",
    "get_current_user",
    "verify_access_token",
]
