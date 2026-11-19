"""Token issuance and verification.

The backend issues two kinds of token:

- **Access token** — a short-lived JWT (15 minutes by default) that
  the frontend sends on every request as `Authorization: Bearer ...`.
  It proves identity only; it carries no permissions.

- **Refresh token** — a long-lived opaque secret (30 days by default)
  stored hashed in the `refresh_tokens` table. The client exchanges it
  for a new access token. Rotation: every use issues a new refresh
  token and revokes the old one, so a stolen token is usable at most
  once.

The refresh token is a random opaque string rather than a JWT on
purpose: it must be revocable, and only its hash is stored, so a
database leak does not hand out valid sessions.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt

from app.config import Settings, get_settings


@dataclass(frozen=True, slots=True)
class IssuedToken:
    """A freshly minted access token and its expiry."""

    access_token: str
    expires_at: datetime
    token_type: str = "Bearer"


def create_access_token(
    *,
    user_id: uuid.UUID | str,
    email: str | None,
    settings: Settings | None = None,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> IssuedToken:
    """Mint a signed access token for a user."""
    cfg = settings or get_settings()
    now = datetime.now(UTC)
    ttl = expires_delta or timedelta(seconds=cfg.access_token_ttl_seconds)
    expires_at = now + ttl

    claims: dict[str, Any] = {
        "sub": str(user_id),
        "email": email,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
        "iss": cfg.jwt_issuer,
        "aud": cfg.jwt_audience,
        "jti": uuid.uuid4().hex,
    }
    if extra_claims:
        claims.update(extra_claims)

    token = jwt.encode(
        claims,
        cfg.jwt_secret.get_secret_value(),
        algorithm=cfg.jwt_algorithm,
    )
    return IssuedToken(access_token=token, expires_at=expires_at)


def decode_access_token(token: str, settings: Settings | None = None) -> dict[str, Any]:
    """Decode and verify an access token issued by this backend.

    Raises `jwt.PyJWTError` when the token is invalid or expired.
    """
    cfg = settings or get_settings()
    return jwt.decode(
        token,
        cfg.jwt_secret.get_secret_value(),
        algorithms=[cfg.jwt_algorithm],
        audience=cfg.jwt_audience,
        issuer=cfg.jwt_issuer,
        options={"require": ["exp", "sub"]},
    )


def generate_refresh_token() -> tuple[str, str]:
    """Generate a refresh token and the hash to store for it.

    Returns `(token, token_hash)`. The token is given to the client
    once; only the hash is persisted. The hash is a SHA-256 digest,
    which is enough because refresh tokens carry 256 bits of entropy
    (unlike a user-chosen password, it needs no slow KDF).
    """
    token = secrets.token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    """Return the SHA-256 hex digest of a refresh token."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def refresh_token_expiry(settings: Settings | None = None) -> datetime:
    """The absolute expiry timestamp for a newly issued refresh token."""
    cfg = settings or get_settings()
    return datetime.now(UTC) + timedelta(seconds=cfg.refresh_token_ttl_seconds)
