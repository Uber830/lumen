"""The trail of the sign-in attempts.

Two jobs live here:

- the **rate limit**: five failed attempts per minute, counted per
  email and per address;
- the **lock**: an account that fails too many times stops signing in
  until the lock expires.

The email is never stored. Only its HMAC is, so the table is safe to
read when the sign-ins are audited: it is not a list of customers.
"""

from __future__ import annotations

import hashlib
import hmac
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import LoginAttempt, User

# The outcome recorded for each kind of attempt.
OUTCOME_SUCCESS = "success"
OUTCOME_INVALID = "invalid_credentials"
OUTCOME_LOCKED = "locked"


def hash_email(email: str, secret: str) -> str:
    """The HMAC of an email, as a hex digest.

    It is keyed, so the hash of an email cannot be matched against a
    table of known hashes without the secret.
    """
    normalized = email.strip().lower().encode()
    return hmac.new(secret.encode(), normalized, hashlib.sha256).hexdigest()


async def record_attempt(
    session: AsyncSession,
    *,
    email_hash: str,
    ip_address: str | None,
    outcome: str,
) -> None:
    """Write one attempt into the trail."""
    session.add(
        LoginAttempt(
            id=uuid.uuid4(),
            email_hash=email_hash,
            ip_address=ip_address,
            outcome=outcome,
        )
    )
    await session.flush()


async def count_failures(
    session: AsyncSession,
    *,
    email_hash: str,
    ip_address: str | None,
    window: timedelta,
) -> int:
    """How many failed attempts happened in the window.

    The pair counts: the same email from the same address. Counting
    the address alone would punish a school behind a single NAT, where
    every teacher shares one address; counting the email alone would
    let a guesser walk away from the limit by changing the address.
    """
    since = datetime.now(UTC) - window
    conditions = [LoginAttempt.email_hash == email_hash]
    if ip_address:
        conditions.append(LoginAttempt.ip_address == ip_address)
    else:
        conditions.append(LoginAttempt.ip_address.is_(None))

    result = await session.execute(
        select(func.count())
        .select_from(LoginAttempt)
        .where(
            LoginAttempt.created_at >= since,
            LoginAttempt.outcome != OUTCOME_SUCCESS,
            and_(*conditions),
        )
    )
    return int(result.scalar_one())


async def lock_account(session: AsyncSession, user: User, *, minutes: int) -> None:
    """Lock an account for a while."""
    user.locked_until = datetime.now(UTC) + timedelta(minutes=minutes)
    await session.flush()


def is_locked(user: User) -> bool:
    """Whether the account is locked right now."""
    if user.locked_until is None:
        return False
    return user.locked_until > datetime.now(UTC)


__all__ = [
    "OUTCOME_INVALID",
    "OUTCOME_LOCKED",
    "OUTCOME_SUCCESS",
    "count_failures",
    "hash_email",
    "is_locked",
    "lock_account",
    "record_attempt",
]
