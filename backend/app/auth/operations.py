"""Authentication operations.

The business logic behind the auth endpoints, expressed as plain
functions over an `AsyncSession`. The router validates the request,
calls these, and returns the result.

Two rules shape everything here:

1. **Never leak whether an account exists.** The forgot-password flow
   answers the same way whether or not the email is registered, and
   the login flow reports invalid credentials rather than "no such
   user". An attacker must not be able to enumerate accounts.

2. **A password change invalidates every session.** The reset flow
   revokes all refresh tokens for the user, so a password reset
   really does lock out whoever had the old password.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AuthenticationError, ConflictError, NotFoundError, ValidationError
from app.core.security import hash_password, needs_rehash, verify_password
from app.core.tokens import (
    IssuedToken,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
    refresh_token_expiry,
)
from app.db.enums import SchoolRole
from app.db.models import (
    PasswordResetToken,
    PlatformRole,
    Profile,
    RefreshToken,
    School,
    SchoolMembership,
    User,
)

# How long a password-reset token stays valid.
PASSWORD_RESET_TTL = timedelta(hours=1)
# How long an activation link stays valid. It lives longer than a
# password-reset link: the admin shares it with a person who may take a
# day to open their mailbox.
ACTIVATION_LINK_TTL = timedelta(days=7)


@dataclass(frozen=True, slots=True)
class IssuedSession:
    """A new session for a user: the tokens plus the session context."""

    user_id: uuid.UUID
    access_token: IssuedToken
    refresh_token: str
    refresh_expires_at: datetime


@dataclass(frozen=True, slots=True)
class UserSession:
    """The context the frontend needs after signing in."""

    user_id: uuid.UUID
    email: str
    profile: Profile | None
    memberships: list[SchoolMembership]
    platform_role: str | None
    # The branding of the primary school. It travels with the session so
    # the first paint of the app already has the school's colour and
    # logo: without it the page would start with the default theme and
    # repaint a second later.
    school: School | None = None

    @property
    def primary_school_id(self) -> uuid.UUID | None:
        """The school the frontend should select by default."""
        primary = next((m for m in self.memberships if m.is_primary), None)
        if primary is not None:
            return primary.school_id
        return self.memberships[0].school_id if self.memberships else None


# ---------------------------------------------------------------------------
# Lookup
# ---------------------------------------------------------------------------


async def find_user_by_email(session: AsyncSession, email: str) -> User | None:
    """Return the user with this email, case-insensitively."""
    normalized = email.strip().lower()
    result = await session.execute(select(User).where(User.email == normalized))
    return result.scalar_one_or_none()


async def get_user(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    """Return a user by id, or None."""
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def load_session_context(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> UserSession:
    """Load everything the frontend needs to render the signed-in state.

    The user, their profile, their active memberships and their
    platform role.
    """
    user = await get_user(session, user_id)
    if user is None:
        raise NotFoundError("User not found.")

    profile_result = await session.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()

    memberships_result = await session.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.revoked_at.is_(None),
        )
        .order_by(
            SchoolMembership.is_primary.desc(),
            SchoolMembership.joined_at.asc(),
        )
    )

    platform_result = await session.execute(
        select(PlatformRole).where(PlatformRole.user_id == user_id)
    )
    platform_role = platform_result.scalar_one_or_none()

    memberships = list(memberships_result.scalars().all())

    # The primary school's branding travels with the session, so the app
    # can paint itself with the school's colours and logo on the very
    # first frame instead of a second later.
    school = await _load_primary_school(session, memberships)

    return UserSession(
        user_id=user.id,
        email=user.email,
        profile=profile,
        memberships=memberships,
        platform_role=platform_role.role.value if platform_role else None,
        school=school,
    )


async def _load_primary_school(
    session: AsyncSession,
    memberships: list[SchoolMembership],
) -> School | None:
    """The school the session is about, or None.

    The primary membership wins; without one, the first membership is
    the school the user works in.
    """
    if not memberships:
        return None

    primary = next((m for m in memberships if m.is_primary), None)
    school_id = primary.school_id if primary is not None else memberships[0].school_id

    result = await session.execute(select(School).where(School.id == school_id))
    return result.scalar_one_or_none()


async def update_profile(
    session: AsyncSession,
    user_id: uuid.UUID,
    changes: dict[str, object],
) -> User:
    """Apply a partial update to a user's profile and/or email.

    ``changes`` is the set of fields the caller actually sent
    (``model_dump(exclude_unset=True)``), so an omitted field is left
    untouched while an explicit null clears it.

    - Profile fields (given_name, family_name, phone, avatar_url) are
      written as given. full_name is special: it is NOT NULL, so a null
      or blank is ignored rather than clearing it.
    - email lives on the user and is globally unique; changing it to an
      address another account already uses raises ConflictError.

    Returns the user (its profile is refreshed) so the caller can build
    the session response.
    """
    user = await get_user(session, user_id)
    if user is None:
        raise NotFoundError("User not found.")

    profile_result = await session.execute(select(Profile).where(Profile.id == user_id))
    profile = profile_result.scalar_one_or_none()
    if profile is None:
        raise NotFoundError("Profile not found.")

    # --- Email (on the user, unique) -----------------------------------
    if "email" in changes:
        new_email = changes["email"]
        if new_email is None or not str(new_email).strip():
            raise ValidationError("Email cannot be empty.", code="invalid_email")
        normalized = str(new_email).strip().lower()
        if normalized != user.email:
            existing = await find_user_by_email(session, normalized)
            if existing is not None and existing.id != user_id:
                raise ConflictError("A user with that email already exists.")
            user.email = normalized

    # --- Profile fields ------------------------------------------------
    if "full_name" in changes:
        # full_name is NOT NULL; only overwrite with a real value.
        value = changes["full_name"]
        if value is not None and str(value).strip():
            profile.full_name = str(value).strip()
    for field in ("given_name", "family_name", "phone", "avatar_url"):
        if field in changes:
            setattr(profile, field, changes[field])

    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("A user with that email already exists.") from exc

    return user


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------


async def create_user(
    session: AsyncSession,
    *,
    email: str,
    full_name: str,
    password: str | None = None,
) -> User:
    """Create a user and their profile.

    Nobody signs up on their own: the accounts are created by the
    platform team, either with a password or pending, waiting for the
    activation link that lets the person set one.

    Raises ConflictError when the email is already registered.
    """
    normalized = email.strip().lower()

    existing = await find_user_by_email(session, normalized)
    if existing is not None:
        raise ConflictError("A user with that email already exists.")

    user = User(
        id=uuid.uuid4(),
        email=normalized,
        # A pending account has no password yet: it sets one through
        # the activation link.
        password_hash=hash_password(password) if password else "",
        full_name=full_name,
        email_verified=False,
    )
    session.add(user)
    session.add(
        Profile(
            id=user.id,
            full_name=full_name,
            locale="es-CO",
        )
    )

    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise ConflictError("A user with that email already exists.") from exc

    return user


# ---------------------------------------------------------------------------
# Login and sessions
# ---------------------------------------------------------------------------


async def authenticate(
    session: AsyncSession,
    *,
    email: str,
    password: str,
) -> User:
    """Verify a password and return the user.

    Raises AuthenticationError with a generic message when the
    credentials do not match. The message never says whether it was
    the email or the password that was wrong.
    """
    user = await find_user_by_email(session, email)
    if user is None:
        # Hash a dummy password so the response time does not reveal
        # whether the account exists.
        hash_password(password)
        raise AuthenticationError("Invalid email or password.")

    if not user.password_hash:
        # The account was created through an invitation and has never
        # set a password.
        raise AuthenticationError(
            "This account has no password yet. Use the reset link to set one."
        )

    if not verify_password(password, user.password_hash):
        raise AuthenticationError("Invalid email or password.")

    if needs_rehash(user.password_hash):
        # The stored hash was made with older parameters; upgrade it
        # now that we have the plaintext.
        user.password_hash = hash_password(password)
        await session.flush()

    return user


async def issue_session(
    session: AsyncSession,
    user: User,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> IssuedSession:
    """Create a new session: an access token and a refresh token."""
    access = create_access_token(user_id=user.id, email=user.email)

    refresh_token, refresh_hash = generate_refresh_token()
    refresh_expires_at = refresh_token_expiry()
    session.add(
        RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=refresh_expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
    )
    await session.flush()

    return IssuedSession(
        user_id=user.id,
        access_token=access,
        refresh_token=refresh_token,
        refresh_expires_at=refresh_expires_at,
    )


async def rotate_refresh_token(
    session: AsyncSession,
    token: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> IssuedSession:
    """Exchange a refresh token for a new pair.

    The old token is revoked and a new one issued, so a stolen token
    is usable at most once. Raises AuthenticationError when the token
    is unknown, revoked or expired.
    """
    token_hash = hash_refresh_token(token)
    result = await session.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise AuthenticationError("Invalid or expired refresh token.")

    if row.revoked_at is not None:
        # The token was already used. Either the client is retrying
        # with a stale token, or someone replayed a stolen one.
        # Revoking every session for the user is the safe answer.
        await revoke_all_refresh_tokens(session, row.user_id)
        raise AuthenticationError("Invalid or expired refresh token.")

    if row.expires_at < datetime.now(UTC):
        raise AuthenticationError("Invalid or expired refresh token.")

    user = await get_user(session, row.user_id)
    if user is None:
        raise AuthenticationError("Invalid or expired refresh token.")

    # Revoke the old token and issue a new one.
    row.revoked_at = datetime.now(UTC)

    access = create_access_token(user_id=user.id, email=user.email)
    refresh_token_value, refresh_hash = generate_refresh_token()
    refresh_expires_at = refresh_token_expiry()
    session.add(
        RefreshToken(
            id=uuid.uuid4(),
            user_id=user.id,
            token_hash=refresh_hash,
            expires_at=refresh_expires_at,
            user_agent=user_agent,
            ip_address=ip_address,
        )
    )
    await session.flush()

    return IssuedSession(
        user_id=user.id,
        access_token=access,
        refresh_token=refresh_token_value,
        refresh_expires_at=refresh_expires_at,
    )


async def revoke_refresh_token(session: AsyncSession, token: str) -> None:
    """Revoke a single refresh token. Unknown tokens are ignored."""
    token_hash = hash_refresh_token(token)
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.token_hash == token_hash, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


async def revoke_all_refresh_tokens(session: AsyncSession, user_id: uuid.UUID) -> None:
    """Revoke every active refresh token of a user."""
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------


async def issue_password_reset_token(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> str:
    """Create a password-reset token and return its plaintext value."""
    token, token_hash = generate_refresh_token()
    session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.now(UTC) + PASSWORD_RESET_TTL,
        )
    )
    await session.flush()
    return token


async def reset_password(session: AsyncSession, token: str, new_password: str) -> User:
    """Consume a reset token and set a new password.

    Every session of the user is revoked: a password reset must lock
    out whoever held the old password.

    Raises AuthenticationError when the token is unknown, already used
    or expired.
    """
    token_hash = hash_refresh_token(token)
    result = await session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise AuthenticationError("Invalid or expired reset token.")
    if row.used_at is not None:
        raise AuthenticationError("This reset token was already used.")
    if row.expires_at < datetime.now(UTC):
        raise AuthenticationError("Invalid or expired reset token.")

    row.used_at = datetime.now(UTC)

    user = await get_user(session, row.user_id)
    if user is None:
        raise NotFoundError("User not found.")

    user.password_hash = hash_password(new_password)
    await session.flush()

    # The account is active now: the activation links are spent.
    await clear_activation_tokens(session, user_id=user.id)
    await revoke_all_refresh_tokens(session, user.id)
    return user


async def set_initial_password(
    session: AsyncSession,
    user_id: uuid.UUID,
    new_password: str,
) -> User:
    """Set the first password of an invited user.

    Raises AuthenticationError when the user already has one, which
    would mean the reset link was used twice.
    """
    user = await get_user(session, user_id)
    if user is None:
        raise NotFoundError("User not found.")
    if user.password_hash:
        raise AuthenticationError("This account already has a password.")

    user.password_hash = hash_password(new_password)
    await session.flush()
    await clear_activation_tokens(session, user_id=user.id)
    return user


async def clear_activation_tokens(session: AsyncSession, *, user_id: uuid.UUID) -> None:
    """Forget the activation links of a user.

    Called when the account is activated: the link has been redeemed, so
    there is nothing left to share. The pending rows are deleted, not
    just marked as used: a link that was never handed out must stop
    working too.
    """
    await session.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
        )
    )


async def issue_activation_token(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> tuple[str, datetime]:
    """Issue a one-time activation token for an invited member.

    The token lets the member set their password. The plaintext is
    returned to the admin, who shares the link right away; only its hash
    is stored.

    The link is rotated: the pending links of the user are dropped
    before the new one is created, so there is only ever one valid
    activation link and the previous one stops working.
    """
    await clear_activation_tokens(session, user_id=user_id)

    token, token_hash = generate_refresh_token()
    expires_at = datetime.now(UTC) + ACTIVATION_LINK_TTL
    session.add(
        PasswordResetToken(
            id=uuid.uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
    )
    await session.flush()
    return token, expires_at


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def has_school_membership(
    session: AsyncSession,
    user_id: uuid.UUID,
    school_id: uuid.UUID,
) -> bool:
    """Return True when the user has an active membership in the school."""
    result = await session.execute(
        select(SchoolMembership.id).where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.revoked_at.is_(None),
        )
    )
    return result.scalar_one_or_none() is not None


async def primary_membership(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> SchoolMembership | None:
    """Return the user's primary active membership, if any."""
    result = await session.execute(
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.revoked_at.is_(None),
        )
        .order_by(
            SchoolMembership.is_primary.desc(),
            SchoolMembership.joined_at.asc(),
        )
        .limit(1)
    )
    return result.scalar_one_or_none()


def is_school_admin(membership: SchoolMembership | None) -> bool:
    """Return True when the membership grants the school_admin role."""
    return membership is not None and membership.role == SchoolRole.SCHOOL_ADMIN


__all__ = [
    "ACTIVATION_LINK_TTL",
    "PASSWORD_RESET_TTL",
    "IssuedSession",
    "UserSession",
    "authenticate",
    "clear_activation_tokens",
    "create_user",
    "find_user_by_email",
    "get_user",
    "has_school_membership",
    "is_school_admin",
    "issue_password_reset_token",
    "issue_session",
    "load_session_context",
    "primary_membership",
    "reset_password",
    "revoke_all_refresh_tokens",
    "revoke_refresh_token",
    "rotate_refresh_token",
    "set_initial_password",
    "update_profile",
]
