"""Tests for the core primitives: password hashing and token issuance."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import jwt
import pytest

from app.core.security import hash_password, needs_rehash, verify_password
from app.core.tokens import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_refresh_token,
)

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------


def test_hash_password_produces_a_different_hash_each_time():
    """Argon2 salts every hash, so the same password hashes differently."""
    first = hash_password("correct horse battery staple")
    second = hash_password("correct horse battery staple")
    assert first != second
    assert first.startswith("$argon2")


def test_hash_password_never_stores_the_plaintext():
    password = "correct horse battery staple"
    assert password not in hash_password(password)


def test_verify_password_accepts_the_right_password():
    password = "correct horse battery staple"
    assert verify_password(password, hash_password(password)) is True


def test_verify_password_rejects_the_wrong_password():
    stored = hash_password("correct horse battery staple")
    assert verify_password("wrong password", stored) is False


def test_verify_password_rejects_a_malformed_hash():
    """A corrupt hash must fail closed, not raise."""
    assert verify_password("anything", "not-a-hash") is False


def test_verify_password_rejects_an_empty_hash():
    assert verify_password("anything", "") is False


def test_hash_password_rejects_an_empty_password():
    with pytest.raises(ValueError):
        hash_password("")


def test_needs_rehash_is_false_for_a_fresh_hash():
    assert needs_rehash(hash_password("whatever")) is False


def test_needs_rehash_is_true_for_a_corrupt_hash():
    assert needs_rehash("not-a-hash") is True


# ---------------------------------------------------------------------------
# The database URL
# ---------------------------------------------------------------------------


def test_a_bare_postgresql_url_gets_the_async_driver():
    """The URL people copy from the dashboard is `postgresql://`.

    SQLAlchemy would default to psycopg2, which is not installed. The
    application is async, so asyncpg is the right driver.
    """
    from app.config import Settings

    settings = Settings(
        database_url="postgresql://user:pass@host:5432/db",
        database_url_override=None,
    )
    assert settings.effective_database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_an_explicit_driver_is_left_alone():
    from app.config import Settings

    settings = Settings(database_url="postgresql+asyncpg://user:pass@host:5432/db")
    assert settings.effective_database_url == "postgresql+asyncpg://user:pass@host:5432/db"


def test_the_override_wins_over_the_url():
    from app.config import Settings

    settings = Settings(
        database_url="postgresql://a:pass@host:5432/a",
        database_url_override="postgresql://b:pass@host:5432/b",
    )
    assert settings.effective_database_url == "postgresql+asyncpg://b:pass@host:5432/b"


def test_a_missing_url_is_a_service_unavailable():
    from app.config import Settings
    from app.core.errors import ServiceUnavailableError

    settings = Settings(database_url="", database_url_override=None)
    with pytest.raises(ServiceUnavailableError):
        _ = settings.effective_database_url


# ---------------------------------------------------------------------------
# The legacy bcrypt path (accounts migrated from Supabase Auth)
# ---------------------------------------------------------------------------


def _bcrypt_hash(password: str) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=10)).decode()


def test_verify_password_accepts_a_bcrypt_hash():
    """The migrated Supabase accounts keep their password."""
    stored = _bcrypt_hash("correct horse battery staple")
    assert stored.startswith("$2")
    assert verify_password("correct horse battery staple", stored) is True


def test_verify_password_rejects_the_wrong_password_for_a_bcrypt_hash():
    stored = _bcrypt_hash("correct horse battery staple")
    assert verify_password("wrong password", stored) is False


def test_verify_password_fails_closed_on_a_truncated_bcrypt_hash():
    """A malformed bcrypt hash must not raise `ValueError`."""
    assert verify_password("anything", "$2a$10$not-a-real-hash") is False


def test_needs_rehash_is_true_for_a_bcrypt_hash():
    """The next successful login upgrades bcrypt to Argon2id."""
    assert needs_rehash(_bcrypt_hash("whatever")) is True


# ---------------------------------------------------------------------------
# Access tokens
# ---------------------------------------------------------------------------


def test_create_access_token_carries_the_expected_claims():
    user_id = uuid.uuid4()
    token = create_access_token(user_id=user_id, email="a@example.com")

    claims = decode_access_token(token.access_token)
    assert claims["sub"] == str(user_id)
    assert claims["email"] == "a@example.com"
    assert claims["aud"] == "lumen-frontend"
    assert claims["iss"] == "lumen-api"
    assert claims["exp"] > claims["iat"]


def test_create_access_token_expires_in_the_configured_window():
    token = create_access_token(user_id=uuid.uuid4(), email="a@example.com")
    delta = token.expires_at - datetime.now(UTC)
    assert timedelta(minutes=10) < delta <= timedelta(minutes=20)


def test_decode_access_token_rejects_a_tampered_token():
    token = create_access_token(user_id=uuid.uuid4(), email="a@example.com")
    tampered = token.access_token[:-4] + "aaaa"
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(tampered)


def test_decode_access_token_rejects_an_expired_token():
    token = create_access_token(
        user_id=uuid.uuid4(),
        email="a@example.com",
        expires_delta=timedelta(seconds=-10),
    )
    with pytest.raises(jwt.ExpiredSignatureError):
        decode_access_token(token.access_token)


def test_decode_access_token_rejects_a_token_signed_with_another_secret():
    token = jwt.encode(
        {
            "sub": str(uuid.uuid4()),
            "aud": "lumen-frontend",
            "iss": "lumen-api",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        "a-different-secret",
        algorithm="HS256",
    )
    with pytest.raises(jwt.InvalidSignatureError):
        decode_access_token(token)


# ---------------------------------------------------------------------------
# Refresh tokens
# ---------------------------------------------------------------------------


def test_generate_refresh_token_returns_a_token_and_its_hash():
    token, token_hash = generate_refresh_token()
    assert token
    assert token_hash == hash_refresh_token(token)
    assert token not in token_hash


def test_refresh_tokens_are_unique():
    tokens = {generate_refresh_token()[0] for _ in range(50)}
    assert len(tokens) == 50


def test_hash_refresh_token_is_stable():
    token, token_hash = generate_refresh_token()
    assert hash_refresh_token(token) == token_hash
