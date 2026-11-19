"""HTTP-level tests for the auth endpoints.

These exercise the full request path: validation, the operation layer
and the response shape the frontend consumes.
"""

from __future__ import annotations

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import hash_refresh_token
from app.db.models import (
    PasswordResetToken,
)
from tests.support import sign_in

pytestmark = pytest.mark.usefixtures("cleanup_users")


def _register(
    make_user,
    client,
    email: str = "signup@example.com",
    password: str = "a good password",
):
    """Create an account the way the platform team does, and sign in."""
    make_user(email=email, password=password, full_name="Sign Up")
    return sign_in(client, email=email, password=password)


# ---------------------------------------------------------------------------
# The accounts
# ---------------------------------------------------------------------------


def test_nobody_creates_an_account_on_their_own(client):
    """The public registration endpoint is gone.

    The accounts are created by the platform team, from the platform
    module.
    """
    response = client.post(
        "/v1/auth/register",
        json={
            "email": "signup@example.com",
            "password": "a good password",
            "full_name": "Sign Up",
        },
    )
    assert response.status_code == 404


def test_sign_in_returns_tokens_and_the_session(make_user, client):
    """A successful sign-in carries the tokens and the session."""
    body = _register(make_user, client)

    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]
    assert body["tokens"]["token_type"] == "Bearer"
    assert body["tokens"]["expires_in"] > 0

    assert body["session"]["user"]["email"] == "signup@example.com"
    assert body["session"]["profile"]["full_name"] == "Sign Up"
    assert body["session"]["memberships"] == []
    assert body["session"]["primary_school_id"] is None
    assert body["session"]["platform_role"] is None


def test_the_email_is_stored_lowercased(make_user, client):
    """The email is normalized when the account is created."""
    make_user(email="Mixed@Example.COM", password="a good password")
    body = sign_in(client, email="mixed@example.com", password="a good password")
    assert body["session"]["user"]["email"] == "mixed@example.com"


def test_the_access_token_works_on_a_protected_route(make_user, client):
    """The token issued at sign-in authenticates the next request."""
    body = _register(make_user, client)
    token = body["tokens"]["access_token"]

    response = client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "signup@example.com"


# ---------------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------------


def test_login_returns_tokens(make_user, client):
    _register(make_user, client, email="login@example.com", password="the right password")

    response = client.post(
        "/v1/auth/login",
        json={"email": "login@example.com", "password": "the right password"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["tokens"]["access_token"]
    assert body["tokens"]["refresh_token"]


def test_login_rejects_a_wrong_password(make_user, client):
    _register(make_user, client, email="login@example.com", password="the right password")

    response = client.post(
        "/v1/auth/login",
        json={"email": "login@example.com", "password": "the wrong password"},
    )
    assert response.status_code == 401


def test_login_rejects_an_unknown_email(client):
    response = client.post(
        "/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever"},
    )
    assert response.status_code == 401


def test_login_does_not_reveal_whether_the_account_exists(make_user, client):
    """The message is the same for a wrong password and a missing account."""
    _register(make_user, client, email="exists@example.com", password="the right password")

    wrong_password = client.post(
        "/v1/auth/login",
        json={"email": "exists@example.com", "password": "wrong"},
    )
    unknown_email = client.post(
        "/v1/auth/login",
        json={"email": "missing@example.com", "password": "wrong"},
    )

    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.json() == unknown_email.json()


def test_login_is_case_insensitive_on_the_email(make_user, client):
    _register(make_user, client, email="case@example.com", password="a password")

    response = client.post(
        "/v1/auth/login",
        json={"email": "CASE@example.com", "password": "a password"},
    )
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Refresh
# ---------------------------------------------------------------------------


def test_refresh_issues_a_new_pair(make_user, client):
    """The old refresh token is revoked and a new one returned."""
    body = _register(make_user, client, email="refresh@example.com")
    old_refresh = body["tokens"]["refresh_token"]

    response = client.post("/v1/auth/refresh", json={"refresh_token": old_refresh})
    assert response.status_code == 200
    new_body = response.json()
    assert new_body["tokens"]["refresh_token"] != old_refresh
    assert new_body["tokens"]["access_token"]


def test_refresh_rejects_an_unknown_token(client):
    response = client.post("/v1/auth/refresh", json={"refresh_token": "nope"})
    assert response.status_code == 401


def test_refresh_rejects_a_used_token(make_user, client):
    """A token can only be used once."""
    body = _register(make_user, client, email="once@example.com")
    refresh_token = body["tokens"]["refresh_token"]

    first = client.post("/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert first.status_code == 200

    second = client.post("/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert second.status_code == 401


def test_logout_revokes_the_refresh_token(make_user, client):
    """After logging out, the refresh token no longer works."""
    body = _register(make_user, client, email="logout@example.com")
    refresh_token = body["tokens"]["refresh_token"]

    logout = client.post("/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout.status_code == 200

    refreshed = client.post("/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refreshed.status_code == 401


def test_replaying_a_refresh_token_revokes_every_session(make_user, client):
    """A replayed token means a stolen token: lock the account.

    The revocation has to survive the failed request. If the request
    rolled it back, the attacker's token would stay usable.
    """
    body = _register(make_user, client, email="replay@example.com")
    first_refresh = body["tokens"]["refresh_token"]

    rotated = client.post("/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert rotated.status_code == 200
    second_refresh = rotated.json()["tokens"]["refresh_token"]

    # The client retries with the token it already used.
    replay = client.post("/v1/auth/refresh", json={"refresh_token": first_refresh})
    assert replay.status_code == 401

    # The other session is revoked too.
    other = client.post("/v1/auth/refresh", json={"refresh_token": second_refresh})
    assert other.status_code == 401


def test_logout_without_a_token_is_accepted(client):
    """Logging out when there is nothing to log out of is not an error."""
    response = client.post("/v1/auth/logout", json={})
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Password reset
# ---------------------------------------------------------------------------


def test_forgot_password_answers_the_same_for_any_email(make_user, client):
    """The response must not reveal whether the email is registered."""
    _register(make_user, client, email="known@example.com")

    known = client.post("/v1/auth/forgot-password", json={"email": "known@example.com"})
    unknown = client.post("/v1/auth/forgot-password", json={"email": "unknown@example.com"})

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json()


async def test_the_reset_token_lets_the_user_set_a_new_password(
    make_user, client, engine, monkeypatch
):
    """The flow: request a reset, use the token, log in with the new password."""
    _register(make_user, client, email="forgot@example.com", password="the old password")

    # The backend has no email provider yet, so the test stands in for
    # the inbox: it captures the plaintext token at the moment it is
    # generated. The database only ever holds its hash.
    from app.core import tokens as tokens_module

    issued: list[str] = []
    original = tokens_module.generate_refresh_token

    def _capture() -> tuple[str, str]:
        token, token_hash = original()
        issued.append(token)
        return token, token_hash

    # The operations module imported the function by name, so the
    # patch has to land there.
    monkeypatch.setattr(
        "app.auth.operations.generate_refresh_token",
        _capture,
    )

    response = client.post("/v1/auth/forgot-password", json={"email": "forgot@example.com"})
    assert response.status_code == 200
    assert len(issued) == 1
    plaintext = issued[0]

    # The database holds the hash, not the token.
    async with AsyncSession(bind=engine, expire_on_commit=False) as session:
        rows = await session.execute(select(PasswordResetToken))
        stored = rows.scalars().all()
        assert len(stored) == 1
        assert stored[0].token_hash != plaintext
        assert stored[0].token_hash == hash_refresh_token(plaintext)

    reset = client.post(
        "/v1/auth/reset-password",
        json={"token": plaintext, "password": "a brand new password"},
    )
    assert reset.status_code == 200

    login = client.post(
        "/v1/auth/login",
        json={"email": "forgot@example.com", "password": "a brand new password"},
    )
    assert login.status_code == 200


def test_reset_password_rejects_an_unknown_token(client):
    response = client.post(
        "/v1/auth/reset-password",
        json={"token": "not-a-token", "password": "a new password"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# The /me endpoint
# ---------------------------------------------------------------------------


def test_me_requires_a_token(client):
    response = client.get("/v1/auth/me")
    assert response.status_code == 401


def test_me_rejects_a_garbage_token(client):
    response = client.get(
        "/v1/auth/me",
        headers={"Authorization": "Bearer not.a.jwt"},
    )
    assert response.status_code == 401


def test_me_returns_the_session_context(make_user, client):
    body = _register(make_user, client, email="me@example.com")
    token = body["tokens"]["access_token"]

    response = client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["user"]["email"] == "me@example.com"


# ---------------------------------------------------------------------------
# PATCH /me — profile updates
# ---------------------------------------------------------------------------


def test_update_me_changes_profile_fields(make_user, client):
    """A user can edit their name, last name and phone."""
    body = _register(make_user, client, email="edit@example.com")
    token = body["tokens"]["access_token"]

    response = client.patch(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"full_name": "Nombre Nuevo", "family_name": "Apellido", "phone": "3001234567"},
    )
    assert response.status_code == 200, response.text
    profile = response.json()["profile"]
    assert profile["full_name"] == "Nombre Nuevo"
    assert profile["family_name"] == "Apellido"
    assert profile["phone"] == "3001234567"


def test_update_me_changes_email(make_user, client):
    """A user can change their email to a free address."""
    body = _register(make_user, client, email="old@example.com")
    token = body["tokens"]["access_token"]

    response = client.patch(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": "new@example.com"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == "new@example.com"

    # The new email works for login; the old one no longer exists.
    assert (
        client.post(
            "/v1/auth/login",
            json={"email": "new@example.com", "password": "a good password"},
        ).status_code
        == 200
    )


def test_update_me_rejects_a_taken_email(make_user, client):
    """Changing the email to one another account uses is a 409."""
    _register(make_user, client, email="taken@example.com")
    body = _register(make_user, client, email="mine@example.com")
    token = body["tokens"]["access_token"]

    response = client.patch(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
        json={"email": "taken@example.com"},
    )
    assert response.status_code == 409


def test_update_me_requires_auth(client):
    """The endpoint is not public."""
    response = client.patch("/v1/auth/me", json={"full_name": "X"})
    assert response.status_code == 401
