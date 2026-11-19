"""Tests of the protection around the sign-in.

The three things that guard the door:

- the **message**: the same one for a wrong password and for an email
  that does not exist, so the endpoint cannot be used to find out who
  has an account;
- the **rate limit**: five failed attempts per minute;
- the **lock**: an account that fails too many times stops signing in.

Every attempt is written to `login_attempts` with the email hashed.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import LoginAttempt

pytestmark = pytest.mark.usefixtures("cleanup_users")

# The rate limit is five attempts per minute by default.
LIMIT = 5


def _register(client, email: str = "ana@example.com", password: str = "a good password"):
    response = client.post(
        "/v1/auth/register",
        json={"email": email, "password": password, "full_name": "Ana Restrepo"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _fail(client, email: str = "ana@example.com", password: str = "wrong password"):
    return client.post("/v1/auth/login", json={"email": email, "password": password})


@pytest.fixture
def low_lock_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    """Lock the account after three failures.

    The rate limit stops the endpoint after five failures in a
    minute, so the lock is only reachable over time; the test lowers
    the threshold to reach it in one go.
    """
    settings = get_settings()
    monkeypatch.setattr(settings, "login_lock_threshold", 3)
    monkeypatch.setattr(settings, "login_rate_limit_attempts", 20)


# ---------------------------------------------------------------------------
# The message
# ---------------------------------------------------------------------------


def test_a_wrong_password_answers_a_generic_message(client):
    """The message does not say which of the two was wrong."""
    _register(client)

    response = _fail(client)

    assert response.status_code == 401
    assert response.json()["detail"] == "El correo o la contraseña no coinciden."
    assert response.json()["code"] == "invalid_credentials"


def test_an_unknown_email_answers_the_same_message(client):
    """An email that does not exist answers exactly the same."""
    _register(client)

    unknown = _fail(client, email="nadie@example.com")
    wrong = _fail(client, password="otra cosa")

    assert unknown.status_code == wrong.status_code == 401
    assert unknown.json()["detail"] == wrong.json()["detail"]


# ---------------------------------------------------------------------------
# The rate limit
# ---------------------------------------------------------------------------


def test_the_rate_limit_stops_the_sixth_attempt(client):
    """After five failures the endpoint answers 429 with a retry hint."""
    _register(client)

    for _ in range(LIMIT):
        assert _fail(client).status_code == 401

    blocked = _fail(client)

    assert blocked.status_code == 429
    assert blocked.json()["code"] == "rate_limited"
    assert blocked.json()["retry_after"] > 0
    assert blocked.headers["Retry-After"] == str(blocked.json()["retry_after"])


def test_the_rate_limit_counts_the_email_and_the_address(client):
    """The limit is per pair: another email from the same address is free."""
    _register(client)

    for index in range(LIMIT):
        _fail(client, email=f"alguien{index}@example.com")

    other = _fail(client, email="otro@example.com")
    assert other.status_code == 401


def test_a_successful_sign_in_is_not_rate_limited(client):
    """The limit counts the failures, not the sign-ins."""
    _register(client)
    _fail(client)

    response = client.post(
        "/v1/auth/login",
        json={"email": "ana@example.com", "password": "a good password"},
    )

    assert response.status_code == 200


# ---------------------------------------------------------------------------
# The lock
# ---------------------------------------------------------------------------


def test_too_many_failures_lock_the_account(
    client, db_session: AsyncSession, low_lock_threshold: None
):
    """The account stops signing in and says so."""
    _register(client)
    for _ in range(3):
        _fail(client)

    response = client.post(
        "/v1/auth/login",
        json={"email": "ana@example.com", "password": "a good password"},
    )

    assert response.status_code == 423
    assert response.json()["code"] == "account_locked"


def test_the_lock_is_only_answered_after_the_password(
    client, db_session: AsyncSession, low_lock_threshold: None
):
    """A wrong password never says that the account is locked."""
    _register(client)
    for _ in range(3):
        _fail(client)

    response = _fail(client)

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


# ---------------------------------------------------------------------------
# The trail
# ---------------------------------------------------------------------------


async def test_every_attempt_is_written_to_the_trail(client, db_session: AsyncSession):
    """The attempts are audited, with the email hashed."""
    _register(client)
    _fail(client)

    result = await db_session.execute(select(LoginAttempt))
    attempts = result.scalars().all()

    assert attempts
    assert all(
        attempt.outcome in {"success", "invalid_credentials", "locked"} for attempt in attempts
    )
    # The email itself is never stored.
    assert all("ana@example.com" not in attempt.email_hash for attempt in attempts)


# ---------------------------------------------------------------------------
# Remember me
# ---------------------------------------------------------------------------


def test_remember_me_keeps_the_cookies_after_the_browser_closes(client):
    """Without it the cookies are session cookies."""
    _register(client)

    response = client.post(
        "/v1/auth/login",
        json={
            "email": "ana@example.com",
            "password": "a good password",
            "remember_me": False,
        },
    )

    assert response.status_code == 200
    cookies = response.headers.get_list("set-cookie")
    refresh = next(cookie for cookie in cookies if cookie.startswith("lumen_refresh="))
    assert "Max-Age" not in refresh


def test_remember_me_gives_the_cookies_a_life(client):
    """With it the cookies live as long as the server allows."""
    _register(client)

    response = client.post(
        "/v1/auth/login",
        json={
            "email": "ana@example.com",
            "password": "a good password",
            "remember_me": True,
        },
    )

    assert response.status_code == 200
    cookies = response.headers.get_list("set-cookie")
    refresh = next(cookie for cookie in cookies if cookie.startswith("lumen_refresh="))
    assert "Max-Age" in refresh
