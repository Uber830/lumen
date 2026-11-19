"""Supabase-scoped tokens for Storage and Realtime.

Phase 4 moves the data path to this backend, but Storage and Realtime
stay on Supabase. Both of them apply their own RLS policies, and
those policies call `auth.uid()` to identify the caller.

This module mints the token that makes that work.

**The trick.** Supabase's JWT is a plain HS256 token signed with the
project's JWT secret. The `sub` claim is the user's id, and
`auth.uid()` reads it. The RLS helper functions
(`is_school_member`, `has_school_role`,
`is_course_subject_teacher`) query `public.school_memberships` and
friends, which since Phase 0 point at `public.users`. So a token
whose `sub` is the user's `public.users.id` makes every storage and
realtime policy work exactly as written.

**Why the backend mints it.** The browser cannot sign a token with
the project's JWT secret without that secret being exposed. The
backend holds it and issues a short-lived token instead.

**The lifetime is short on purpose.** One hour, and the browser asks
for a new one when it expires. A leaked token grants the same access
the user already has, for at most an hour.

This is *not* an authentication token: `app/auth/dependencies.py`
does not accept it. It cannot be used to call the API.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt

from app.config import Settings, get_settings

# How long a Storage/Realtime token is valid.
SUPABASE_TOKEN_TTL = timedelta(hours=1)

# The audience Supabase expects for a user token.
SUPABASE_AUDIENCE = "authenticated"


class SupabaseTokenUnavailable(RuntimeError):
    """Raised when the project JWT secret is not configured.

    Without it the browser cannot talk to Storage or Realtime with the
    right permissions. The rest of the API keeps working.
    """


def mint_supabase_token(
    *,
    user_id: uuid.UUID | str,
    email: str | None = None,
    settings: Settings | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Mint a short-lived token for Supabase Storage and Realtime.

    Raises SupabaseTokenUnavailable when the project JWT secret is
    not configured.
    """
    cfg = settings or get_settings()

    secret = cfg.supabase_jwt_secret
    if secret is None:
        raise SupabaseTokenUnavailable(
            "SUPABASE_JWT_SECRET is not configured, so the browser cannot "
            "reach Supabase Storage or Realtime with the right permissions."
        )

    now = datetime.now(UTC)
    expires_at = now + (expires_delta or SUPABASE_TOKEN_TTL)

    claims: dict[str, object] = {
        "sub": str(user_id),
        "role": SUPABASE_AUDIENCE,
        "aud": SUPABASE_AUDIENCE,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }
    if email is not None:
        claims["email"] = email

    return jwt.encode(
        claims,
        secret.get_secret_value(),
        algorithm="HS256",
    )


def supabase_token_available(settings: Settings | None = None) -> bool:
    """True when a Supabase token can be minted."""
    cfg = settings or get_settings()
    return cfg.supabase_jwt_secret is not None


__all__ = [
    "SUPABASE_AUDIENCE",
    "SUPABASE_TOKEN_TTL",
    "SupabaseTokenUnavailable",
    "mint_supabase_token",
    "supabase_token_available",
]
