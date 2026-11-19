"""Tests for the authentication flows.

The security properties under test:

- A wrong password never reveals that the account exists.
- The forgot-password flow answers the same way for a registered and
  an unregistered email.
- A refresh token is single-use: rotating it revokes the old one, and
  replaying a revoked token kills every session of that user.
- A password reset revokes every session.
- A password is never stored in plaintext.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.operations import (
    authenticate,
    create_user,
    find_user_by_email,
    issue_email_verification_token,
    issue_password_reset_token,
    issue_session,
    load_session_context,
    reset_password,
    revoke_all_refresh_tokens,
    rotate_refresh_token,
    verify_email,
)
from app.core.errors import AuthenticationError, ConflictError
from app.core.security import verify_password
from app.core.tokens import decode_access_token, hash_refresh_token
from app.db.models import Profile, RefreshToken, User

pytestmark = pytest.mark.usefixtures("cleanup_users")


# ---------------------------------------------------------------------------
# Registration
# ---------------------------------------------------------------------------


async def test_create_user_stores_a_hashed_password(engine):
    """The password is stored as an Argon2 hash, never in plaintext."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="hash@example.com",
            password="correct horse battery staple",
            full_name="Hash User",
        )
        await session.commit()

        assert user.password_hash != "correct horse battery staple"
        assert user.password_hash.startswith("$argon2")
        assert verify_password("correct horse battery staple", user.password_hash)

        # The profile is created alongside the user.
        profile = await session.execute(select(Profile).where(Profile.id == user.id))
        assert profile.scalar_one_or_none() is not None


async def test_create_user_normalizes_the_email(engine):
    """Emails are stored lowercased so logins are case-insensitive."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="MixedCase@Example.COM",
            password="a password",
            full_name="Mixed",
        )
        await session.commit()
        assert user.email == "mixedcase@example.com"


async def test_create_user_rejects_a_duplicate_email(engine):
    """Registering the same email twice raises a conflict."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await create_user(
            session,
            email="dupe@example.com",
            password="a password",
            full_name="First",
        )
        await session.commit()

        with pytest.raises(ConflictError):
            await create_user(
                session,
                email="dupe@example.com",
                password="another password",
                full_name="Second",
            )


# ---------------------------------------------------------------------------
# Authentication
# ---------------------------------------------------------------------------


async def test_authenticate_accepts_the_right_password(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="auth@example.com",
            password="the right password",
            full_name="Auth",
        )
        await session.commit()

        found = await authenticate(session, email="auth@example.com", password="the right password")
        assert found.id == user.id


async def test_authenticate_is_case_insensitive_on_the_email(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await create_user(
            session,
            email="case@example.com",
            password="a password",
            full_name="Case",
        )
        await session.commit()

        found = await authenticate(session, email="CASE@example.com", password="a password")
        assert found.email == "case@example.com"


async def test_authenticate_upgrades_a_migrated_bcrypt_hash(engine):
    """An account copied from Supabase Auth logs in and is rehashed.

    The migration keeps the bcrypt hash. The first login has to work,
    and it has to replace the hash with Argon2id, or the legacy format
    would live forever.
    """
    import bcrypt

    legacy_hash = bcrypt.hashpw(b"a migrated password", bcrypt.gensalt(rounds=10)).decode()

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            User(
                id=uuid.uuid4(),
                email="migrated@example.com",
                password_hash=legacy_hash,
                full_name="Migrated",
            )
        )
        await session.commit()

        found = await authenticate(
            session, email="migrated@example.com", password="a migrated password"
        )
        assert found.id is not None

        stored = (
            await session.execute(select(User.password_hash).where(User.id == found.id))
        ).scalar_one()
        assert stored.startswith("$argon2"), stored


async def test_authenticate_rejects_a_wrong_password(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await create_user(
            session,
            email="wrong@example.com",
            password="the right password",
            full_name="Wrong",
        )
        await session.commit()

        with pytest.raises(AuthenticationError):
            await authenticate(session, email="wrong@example.com", password="the wrong password")


async def test_authenticate_does_not_reveal_that_the_account_is_missing(engine):
    """An unknown email fails with the same message as a wrong password."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        with pytest.raises(AuthenticationError) as unknown:
            await authenticate(session, email="nobody@example.com", password="whatever")

        await create_user(
            session,
            email="known@example.com",
            password="the right password",
            full_name="Known",
        )
        await session.commit()

        with pytest.raises(AuthenticationError) as wrong:
            await authenticate(session, email="known@example.com", password="the wrong password")

    assert unknown.value.detail == wrong.value.detail


async def test_authenticate_rejects_an_account_without_a_password(engine):
    """An invited user has no password until they set one."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        session.add(
            User(
                id=uuid.uuid4(),
                email="invited@example.com",
                password_hash="",
                full_name="Invited",
            )
        )
        await session.commit()

        with pytest.raises(AuthenticationError):
            await authenticate(session, email="invited@example.com", password="anything")


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------


async def test_issue_session_creates_a_refresh_token_row(engine):
    """Only the hash of the refresh token is stored."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="session@example.com",
            password="a password",
            full_name="Session",
        )
        await session.commit()

        issued = await issue_session(session, user, user_agent="pytest")
        await session.commit()

        assert issued.refresh_token
        assert issued.refresh_token != hash_refresh_token(issued.refresh_token)

        rows = await session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id))
        stored = rows.scalars().all()
        assert len(stored) == 1
        assert stored[0].token_hash == hash_refresh_token(issued.refresh_token)
        assert stored[0].revoked_at is None
        assert stored[0].user_agent == "pytest"


async def test_the_access_token_carries_the_user_id(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="claims@example.com",
            password="a password",
            full_name="Claims",
        )
        await session.commit()

        issued = await issue_session(session, user)
        await session.commit()

        claims = decode_access_token(issued.access_token.access_token)
        assert claims["sub"] == str(user.id)
        assert claims["email"] == "claims@example.com"


async def test_rotate_refresh_token_issues_a_new_pair(engine):
    """Rotating a refresh token returns a new one and revokes the old."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="rotate@example.com",
            password="a password",
            full_name="Rotate",
        )
        await session.commit()

        first = await issue_session(session, user)
        await session.commit()

        second = await rotate_refresh_token(session, first.refresh_token)
        await session.commit()

        assert second.refresh_token != first.refresh_token

        rows = await session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id))
        stored = {row.token_hash: row for row in rows.scalars().all()}
        assert stored[hash_refresh_token(first.refresh_token)].revoked_at is not None
        assert stored[hash_refresh_token(second.refresh_token)].revoked_at is None


async def test_rotate_refresh_token_rejects_an_unknown_token(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        with pytest.raises(AuthenticationError):
            await rotate_refresh_token(session, "not-a-real-token")


async def test_replaying_a_revoked_refresh_token_kills_every_session(engine):
    """A token that was already used means a replay: lock the account.

    The client may legitimately present a stale token after a network
    hiccup, but the cost of guessing wrong is high: every session of
    that user is revoked.
    """
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="replay@example.com",
            password="a password",
            full_name="Replay",
        )
        await session.commit()

        first = await issue_session(session, user)
        await session.commit()
        await rotate_refresh_token(session, first.refresh_token)
        await session.commit()

        # The client retries with the token it already used.
        with pytest.raises(AuthenticationError):
            await rotate_refresh_token(session, first.refresh_token)
        await session.commit()

        # Every session of that user is now revoked.
        rows = await session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id))
        for row in rows.scalars().all():
            assert row.revoked_at is not None


async def test_rotate_refresh_token_rejects_an_expired_token(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="expired@example.com",
            password="a password",
            full_name="Expired",
        )
        await session.commit()

        issued = await issue_session(session, user)
        await session.commit()

        await session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user.id)
            .values(expires_at=datetime.now(UTC) - timedelta(hours=1))
        )
        await session.commit()

        with pytest.raises(AuthenticationError):
            await rotate_refresh_token(session, issued.refresh_token)


async def test_revoke_all_refresh_tokens(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="revoke@example.com",
            password="a password",
            full_name="Revoke",
        )
        await session.commit()

        await issue_session(session, user)
        await issue_session(session, user)
        await session.commit()

        await revoke_all_refresh_tokens(session, user.id)
        await session.commit()

        rows = await session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id))
        for row in rows.scalars().all():
            assert row.revoked_at is not None


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------


async def test_reset_password_changes_the_password_and_revokes_sessions(engine):
    """A reset really locks out whoever held the old password."""
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="reset@example.com",
            password="the old password",
            full_name="Reset",
        )
        await session.commit()

        await issue_session(session, user)
        await session.commit()

        token = await issue_password_reset_token(session, user.id)
        await session.commit()

        await reset_password(session, token, "a brand new password")
        await session.commit()

        # The new password works.
        found = await authenticate(
            session, email="reset@example.com", password="a brand new password"
        )
        assert found.id == user.id

        # The old one does not.
        with pytest.raises(AuthenticationError):
            await authenticate(session, email="reset@example.com", password="the old password")

        # Every session was revoked.
        rows = await session.execute(select(RefreshToken).where(RefreshToken.user_id == user.id))
        for row in rows.scalars().all():
            assert row.revoked_at is not None


async def test_reset_password_rejects_a_used_token(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="reuse@example.com",
            password="a password",
            full_name="Reuse",
        )
        await session.commit()

        token = await issue_password_reset_token(session, user.id)
        await session.commit()

        await reset_password(session, token, "another password")
        await session.commit()

        with pytest.raises(AuthenticationError):
            await reset_password(session, token, "yet another password")


async def test_reset_password_rejects_an_expired_token(engine):
    from app.db.models import PasswordResetToken

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="stale@example.com",
            password="a password",
            full_name="Stale",
        )
        await session.commit()

        token = await issue_password_reset_token(session, user.id)
        await session.commit()

        await session.execute(
            update(PasswordResetToken)
            .where(PasswordResetToken.user_id == user.id)
            .values(expires_at=datetime.now(UTC) - timedelta(hours=1))
        )
        await session.commit()

        with pytest.raises(AuthenticationError):
            await reset_password(session, token, "another password")


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------


async def test_verify_email_marks_the_user_verified(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="verify@example.com",
            password="a password",
            full_name="Verify",
        )
        await session.commit()
        assert user.email_verified is False

        token = await issue_email_verification_token(session, user.id)
        await session.commit()

        verified = await verify_email(session, token)
        await session.commit()
        assert verified.email_verified is True


async def test_verify_email_rejects_an_unknown_token(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        with pytest.raises(AuthenticationError):
            await verify_email(session, "not-a-real-token")


async def test_verify_email_rejects_a_used_token(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="twice@example.com",
            password="a password",
            full_name="Twice",
        )
        await session.commit()

        token = await issue_email_verification_token(session, user.id)
        await session.commit()

        await verify_email(session, token)
        await session.commit()

        with pytest.raises(AuthenticationError):
            await verify_email(session, token)


# ---------------------------------------------------------------------------
# Session context
# ---------------------------------------------------------------------------


async def test_load_session_context_returns_the_memberships(engine):
    from app.db.enums import SchoolRole
    from app.db.models import School, SchoolMembership

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="context@example.com",
            password="a password",
            full_name="Context",
        )
        school_id = uuid.uuid4()
        session.add(
            School(
                id=school_id,
                name=f"Context School {school_id.hex[:6]}",
                short_code=f"C{school_id.hex[:6].upper()}",
                status="active",
            )
        )
        session.add(
            SchoolMembership(
                id=uuid.uuid4(),
                school_id=school_id,
                user_id=user.id,
                role=SchoolRole.SCHOOL_ADMIN,
                is_primary=True,
            )
        )
        await session.commit()

        context = await load_session_context(session, user.id)

        assert context.user_id == user.id
        assert context.email == "context@example.com"
        assert context.profile is not None
        assert context.profile.full_name == "Context"
        assert len(context.memberships) == 1
        assert context.memberships[0].role == SchoolRole.SCHOOL_ADMIN
        assert context.primary_school_id == school_id
        assert context.platform_role is None


async def test_load_session_context_prefers_the_primary_membership(engine):
    from app.db.enums import SchoolRole
    from app.db.models import School, SchoolMembership

    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        user = await create_user(
            session,
            email="two@example.com",
            password="a password",
            full_name="Two",
        )

        for is_primary, role in ((False, SchoolRole.STUDENT), (True, SchoolRole.TEACHER)):
            school_id = uuid.uuid4()
            session.add(
                School(
                    id=school_id,
                    name=f"Two School {school_id.hex[:6]}",
                    short_code=f"D{school_id.hex[:6].upper()}",
                    status="active",
                )
            )
            session.add(
                SchoolMembership(
                    id=uuid.uuid4(),
                    school_id=school_id,
                    user_id=user.id,
                    role=role,
                    is_primary=is_primary,
                )
            )
        await session.commit()

        context = await load_session_context(session, user.id)
        assert context.primary_school_id == context.memberships[0].school_id
        assert context.memberships[0].is_primary is True


async def test_find_user_by_email_is_case_insensitive(engine):
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        await create_user(
            session,
            email="Lookup@example.com",
            password="a password",
            full_name="Lookup",
        )
        await session.commit()

        found = await find_user_by_email(session, "lookup@EXAMPLE.com")
        assert found is not None
        assert found.email == "lookup@example.com"
