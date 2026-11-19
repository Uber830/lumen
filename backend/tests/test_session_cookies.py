"""Tests for the cookie session and the Supabase token bridge.

Two properties:

- the browser authenticates with the cookie alone, and the token
  never reaches the page's JavaScript;
- the Supabase token is scoped to Storage and Realtime, and the API
  refuses it as an authentication token.
"""

from __future__ import annotations

import uuid

import jwt
import pytest

from app.config import Settings
from app.core.supabase_tokens import (
    SUPABASE_TOKEN_TTL,
    SupabaseTokenUnavailable,
    mint_supabase_token,
)

# ---------------------------------------------------------------------------
# The cookies
# ---------------------------------------------------------------------------


async def test_register_sets_the_session_cookies(client, engine):
    """The browser's session travels in httpOnly cookies."""
    response = client.post(
        "/v1/auth/register",
        json={
            "email": f"cookie-{uuid.uuid4().hex[:8]}@example.com",
            "password": "a good password",
            "full_name": "Cookie User",
        },
    )
    assert response.status_code == 201, response.text

    assert "lumen_access" in response.cookies
    assert "lumen_refresh" in response.cookies

    # httpOnly: the page's JavaScript cannot read them.
    for name in ("lumen_access", "lumen_refresh"):
        header = response.headers.get_list("set-cookie")
        matching = [h for h in header if h.startswith(f"{name}=")]
        assert matching, f"{name} was not set"
        assert "HttpOnly" in matching[0]
        assert "SameSite=lax" in matching[0]


async def test_the_cookie_alone_authenticates_the_request(client, engine):
    """The browser sends the cookie; no Authorization header needed."""
    email = f"cookieonly-{uuid.uuid4().hex[:8]}@example.com"
    registered = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "a good password", "full_name": "Cookie Only"},
    )
    assert registered.status_code == 201, registered.text

    # A fresh client that only has the cookies.
    cookies = {
        "lumen_access": registered.cookies["lumen_access"],
        "lumen_refresh": registered.cookies["lumen_refresh"],
    }
    response = client.get("/v1/auth/me", cookies=cookies)
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == email


async def test_login_sets_the_cookies(client, engine):
    email = f"login-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/v1/auth/register",
        json={"email": email, "password": "a good password", "full_name": "Login"},
    )

    response = client.post(
        "/v1/auth/login",
        json={"email": email, "password": "a good password"},
    )
    assert response.status_code == 200, response.text
    assert "lumen_access" in response.cookies
    assert "lumen_refresh" in response.cookies


async def test_logout_clears_the_cookies(client, engine):
    email = f"logout-{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/v1/auth/register",
        json={"email": email, "password": "a good password", "full_name": "Logout"},
    )

    response = client.post("/v1/auth/logout", json={"refresh_token": ""})
    assert response.status_code == 200

    cleared = response.headers.get_list("set-cookie")
    assert any(h.startswith("lumen_access=") and "Max-Age=0" in h for h in cleared)


async def test_refresh_reads_the_cookie(client, engine):
    """The browser cannot read the refresh cookie, so it posts an empty body."""
    email = f"refresh-{uuid.uuid4().hex[:8]}@example.com"
    registered = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "a good password", "full_name": "Refresh"},
    )
    cookies = {
        "lumen_access": registered.cookies["lumen_access"],
        "lumen_refresh": registered.cookies["lumen_refresh"],
    }

    response = client.post("/v1/auth/refresh", json={"refresh_token": ""}, cookies=cookies)
    assert response.status_code == 200, response.text
    # A new pair came back, in the cookies.
    assert response.cookies["lumen_access"] != cookies["lumen_access"]


async def test_refresh_without_a_token_is_refused(client):
    response = client.post("/v1/auth/refresh", json={"refresh_token": ""})
    assert response.status_code == 401


async def test_a_cookie_with_a_bad_token_is_refused(client):
    """The cookie is not a way around the signature check."""
    response = client.get(
        "/v1/auth/me",
        cookies={"lumen_access": "not.a.jwt"},
    )
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# The Supabase token bridge
# ---------------------------------------------------------------------------


def test_the_supabase_token_carries_the_caller_id():
    """`auth.uid()` reads the `sub` claim, so it has to be the caller's."""
    user_id = uuid.uuid4()
    token = mint_supabase_token(
        user_id=user_id,
        email="a@example.com",
        settings=_settings_with_secret(),
    )

    claims = jwt.decode(
        token,
        "supabase-project-secret-for-testing-1234",
        algorithms=["HS256"],
        audience="authenticated",
    )
    assert claims["sub"] == str(user_id)
    assert claims["aud"] == "authenticated"
    assert claims["role"] == "authenticated"
    assert claims["email"] == "a@example.com"


def test_the_supabase_token_is_short_lived():
    """An hour: a leaked token grants the same access, briefly."""
    token = mint_supabase_token(
        user_id=uuid.uuid4(),
        settings=_settings_with_secret(),
    )
    claims = jwt.decode(
        token,
        "supabase-project-secret-for-testing-1234",
        algorithms=["HS256"],
        audience="authenticated",
    )
    assert claims["exp"] - claims["iat"] == int(SUPABASE_TOKEN_TTL.total_seconds())


def test_minting_without_the_secret_raises():
    """Without the project secret, Storage and Realtime do not work."""
    from app.config import Settings

    settings = Settings(supabase_jwt_secret=None)
    with pytest.raises(SupabaseTokenUnavailable):
        mint_supabase_token(user_id=uuid.uuid4(), settings=settings)


async def test_the_supabase_token_endpoint(client, engine):
    """The endpoint hands out the short-lived token."""
    email = f"sb-{uuid.uuid4().hex[:8]}@example.com"
    registered = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "a good password", "full_name": "SB"},
    )
    assert registered.status_code == 201, registered.text

    # The register response carries one too.
    assert registered.json()["supabase_token"]

    response = client.get("/v1/auth/supabase-token")
    assert response.status_code == 200, response.text
    token = response.json()["token"]
    assert token


async def test_the_supabase_token_is_not_an_authentication_token(client, engine):
    """The API refuses it: it is scoped to Storage and Realtime."""
    email = f"sbauth-{uuid.uuid4().hex[:8]}@example.com"
    registered = client.post(
        "/v1/auth/register",
        json={"email": email, "password": "a good password", "full_name": "SB Auth"},
    )
    supabase_token = registered.json()["supabase_token"]
    assert supabase_token

    # The API does not accept it: the audience is wrong.
    response = client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {supabase_token}"},
        cookies={},
    )
    assert response.status_code == 401, response.text


def _settings_with_secret() -> Settings:
    """Settings with a project JWT secret configured."""
    return Settings(supabase_jwt_secret="supabase-project-secret-for-testing-1234")
