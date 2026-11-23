"""Tests for the cookie session.

The browser authenticates with the cookie alone, and the token never
reaches the page's JavaScript.
"""

from __future__ import annotations

import uuid

# ---------------------------------------------------------------------------
# The cookies
# ---------------------------------------------------------------------------


async def test_the_cookie_alone_authenticates_the_request(client, engine, make_user):
    """The browser sends the cookie; no Authorization header needed."""
    email = f"cookieonly-{uuid.uuid4().hex[:8]}@example.com"
    make_user(email=email, password="a good password", full_name="Cookie Only")
    registered = client.post(
        "/v1/auth/login",
        json={"email": email, "password": "a good password"},
    )
    assert registered.status_code == 200, registered.text

    # A fresh client that only has the cookies.
    cookies = {
        "lumen_access": registered.cookies["lumen_access"],
        "lumen_refresh": registered.cookies["lumen_refresh"],
    }
    response = client.get("/v1/auth/me", cookies=cookies)
    assert response.status_code == 200, response.text
    assert response.json()["user"]["email"] == email


async def test_login_sets_the_cookies(client, engine, make_user):
    """The browser's session travels in httpOnly cookies."""
    email = f"login-{uuid.uuid4().hex[:8]}@example.com"
    make_user(email=email, password="a good password", full_name="Login")

    response = client.post(
        "/v1/auth/login",
        json={"email": email, "password": "a good password"},
    )
    assert response.status_code == 200, response.text
    assert "lumen_access" in response.cookies
    assert "lumen_refresh" in response.cookies

    # httpOnly: the page's JavaScript cannot read them.
    for name in ("lumen_access", "lumen_refresh"):
        header = response.headers.get_list("set-cookie")
        matching = [h for h in header if h.startswith(f"{name}=")]
        assert matching, f"{name} was not set"
        assert "HttpOnly" in matching[0]
        assert "SameSite=lax" in matching[0]


async def test_logout_clears_the_cookies(client, engine, make_user):
    email = f"logout-{uuid.uuid4().hex[:8]}@example.com"
    make_user(email=email, password="a good password", full_name="Logout")

    response = client.post("/v1/auth/logout", json={"refresh_token": ""})
    assert response.status_code == 200

    cleared = response.headers.get_list("set-cookie")
    assert any(h.startswith("lumen_access=") and "Max-Age=0" in h for h in cleared)


async def test_refresh_reads_the_cookie(client, engine, make_user):
    """The browser cannot read the refresh cookie, so it posts an empty body."""
    email = f"refresh-{uuid.uuid4().hex[:8]}@example.com"
    make_user(email=email, password="a good password", full_name="Refresh")
    registered = client.post(
        "/v1/auth/login",
        json={"email": email, "password": "a good password"},
    )
    assert registered.status_code == 200, registered.text
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
