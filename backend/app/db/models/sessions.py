"""Session and token-issuance models.

These tables back the authentication flows that Phase 1 adds:

- `refresh_tokens` — the long-lived opaque tokens the client exchanges
  for a new access token. Only the SHA-256 hash is stored, so a
  database leak does not hand out valid sessions. Rotation: every use
  issues a new token and revokes the old one, so a stolen token is
  usable at most once.

- `password_reset_tokens` — single-use tokens for the "forgot my
  password" flow.

- `email_verification_tokens` — single-use tokens for verifying an
  email address.

Both token tables share the same shape: a hash to look up, an expiry,
and the timestamps needed to tell "used" from "expired".
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, created_at


class RefreshToken(Base):
    """A refresh token issued to a client.

    The token itself is never stored: only `token_hash`, the SHA-256
    digest of the token. A row whose `revoked_at` is set has been
    rotated out or explicitly revoked.
    """

    __tablename__ = "refresh_tokens"
    __table_args__ = ({"schema": "public"},)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    # Where the token was issued from. Purely informational: it helps
    # spot a token replayed from an unexpected network.
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = created_at()

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<RefreshToken user={self.user_id}>"


class PasswordResetToken(Base):
    """A single-use token that lets a user set a new password.

    Storing the hash rather than the token means the row is useless to
    anyone who reads the database.
    """

    __tablename__ = "password_reset_tokens"
    __table_args__ = ({"schema": "public"},)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()


class EmailVerificationToken(Base):
    """A single-use token that verifies an email address.

    The registration flow creates the user and the profile first, so
    the user can sign in while the email is still unverified. The
    entitlements guard, not the auth guard, is what checks
    `email_verified`.
    """

    __tablename__ = "email_verification_tokens"
    __table_args__ = ({"schema": "public"},)
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("public.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = created_at()


__all__ = [
    "EmailVerificationToken",
    "PasswordResetToken",
    "RefreshToken",
]
