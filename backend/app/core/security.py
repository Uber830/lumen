"""Password hashing.

Lumen stores passwords as Argon2id hashes. Argon2 is the current
recommendation for password storage: it is memory-hard, so a stolen
hash database is expensive to attack with GPUs.

The parameters live in `Settings` so they can be tuned without a code
change. The defaults (t=3, m=64MiB, p=4) are a sensible balance for
an interactive login on modest hardware: roughly 50-80 ms per hash on
a modern server core.

One legacy format is accepted: bcrypt. The accounts that came from
Supabase Auth have bcrypt hashes, and rejecting them would lock every
existing user out. A bcrypt hash verifies and is then upgraded to
Argon2id on the same login (`needs_rehash` returns True for it), so
the legacy path drains itself.

Never log or return a hash. The helpers here are the only place that
touches a password.
"""

from __future__ import annotations

import bcrypt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.config import Settings, get_settings

# Errors that mean "this password does not match". They are grouped so
# callers can treat them uniformly without importing argon2.
PASSWORD_MISMATCH_ERRORS = (VerifyMismatchError, VerificationError, InvalidHashError)

# The prefixes of a bcrypt hash, as produced by Supabase Auth.
_BCRYPT_PREFIXES = ("$2a$", "$2b$", "$2y$")

# bcrypt only looks at the first 72 bytes of a password; newer
# releases raise instead of silently truncating.
_BCRYPT_MAX_BYTES = 72


def _is_bcrypt(password_hash: str) -> bool:
    """Whether the stored hash is a legacy bcrypt one."""
    return password_hash.startswith(_BCRYPT_PREFIXES)


def _hasher(settings: Settings | None = None) -> PasswordHasher:
    """Build a PasswordHasher from the configured parameters."""
    cfg = settings or get_settings()
    return PasswordHasher(
        time_cost=cfg.argon2_time_cost,
        memory_cost=cfg.argon2_memory_cost,
        parallelism=cfg.argon2_parallelism,
    )


def hash_password(password: str, settings: Settings | None = None) -> str:
    """Hash a plaintext password with Argon2id.

    Returns the encoded hash, which already embeds the algorithm,
    parameters and salt. Store it verbatim.
    """
    if not password:
        raise ValueError("password must not be empty")
    return _hasher(settings).hash(password)


def verify_password(
    password: str,
    password_hash: str,
    settings: Settings | None = None,
) -> bool:
    """Check a plaintext password against a stored hash.

    Returns False on mismatch, on a malformed hash, and on any other
    verification error. It never raises for bad input: a caller that
    gets False should treat the credentials as invalid.

    A bcrypt hash (the legacy Supabase format) is checked with bcrypt.
    Callers upgrade it on success by asking `needs_rehash`.

    Note: this function does not re-hash on success. If the stored
    hash was produced with weaker parameters, call
    `needs_rehash` and upgrade it on the next successful login.
    """
    if _is_bcrypt(password_hash):
        return _verify_bcrypt(password, password_hash)

    try:
        return _hasher(settings).verify(password_hash, password)
    except PASSWORD_MISMATCH_ERRORS:
        return False


def _verify_bcrypt(password: str, password_hash: str) -> bool:
    """Check a password against a bcrypt hash, never raising."""
    encoded = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    try:
        return bcrypt.checkpw(encoded, password_hash.encode("utf-8"))
    except ValueError:
        # A malformed hash: treat it as a mismatch.
        return False


def needs_rehash(password_hash: str, settings: Settings | None = None) -> bool:
    """Return True when a stored hash should be upgraded.

    True when the hash was made with older/weaker parameters than the
    ones currently configured, and always True for a bcrypt hash: the
    next successful login replaces it with Argon2id.
    """
    if _is_bcrypt(password_hash):
        return True

    try:
        return _hasher(settings).check_needs_rehash(password_hash)
    except InvalidHashError:
        # An unreadable hash can never be validated, so treat it as
        # needing replacement. The caller will fail verification
        # anyway and force a password reset.
        return True
