"""JWT verification tests.

The backend is the only issuer of tokens. A token is accepted only
when it is signed with the configured secret and carries the right
issuer, audience and expiry.
"""

from __future__ import annotations

import time

import jwt
import pytest
from fastapi import HTTPException

from app.auth import verify_access_token
from app.config import Settings
from tests.conftest import TEST_JWT_SECRET, mint_token


def test_verify_access_token_returns_current_user():
    """A token issued by the backend verifies."""
    user = verify_access_token(mint_token(), Settings())
    assert user.user_id == "11111111-1111-1111-1111-111111111111"
    assert user.email == "admin@example.com"


def test_verify_access_token_rejects_an_expired_token():
    token = mint_token(expires_in=-60)
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token, Settings())
    assert exc.value.status_code == 401


def test_verify_access_token_rejects_the_wrong_audience():
    """A token minted for another service is not accepted here."""
    token = mint_token(audience="some-other-service")
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token, Settings())
    assert exc.value.status_code == 401


def test_verify_access_token_rejects_the_wrong_issuer():
    token = mint_token(issuer="somebody-else")
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token, Settings())
    assert exc.value.status_code == 401


def test_verify_access_token_rejects_the_wrong_signature():
    """A token signed with another key is not accepted."""
    token = mint_token(secret="a-different-secret")
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token, Settings())
    assert exc.value.status_code == 401


def test_verify_access_token_rejects_a_token_without_an_expiry():
    """`exp` is required: a token that never expires is not a token."""
    now = int(time.time())
    token = jwt.encode(
        {
            "sub": "u1",
            "email": "u@example.com",
            "aud": "lumen-frontend",
            "iss": "lumen-api",
            "iat": now,
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token, Settings())
    assert exc.value.status_code == 401


def test_verify_access_token_rejects_a_token_without_a_subject():
    now = int(time.time())
    token = jwt.encode(
        {
            "email": "u@example.com",
            "aud": "lumen-frontend",
            "iss": "lumen-api",
            "iat": now,
            "exp": now + 600,
        },
        TEST_JWT_SECRET,
        algorithm="HS256",
    )
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token, Settings())
    assert exc.value.status_code == 401


def test_verify_access_token_rejects_garbage():
    with pytest.raises(HTTPException) as exc:
        verify_access_token("not.a.jwt", Settings())
    assert exc.value.status_code == 401


def test_the_error_message_does_not_say_what_is_wrong():
    """The reason is not echoed back: it would help an attacker."""
    token = mint_token(secret="a-different-secret")
    with pytest.raises(HTTPException) as exc:
        verify_access_token(token, Settings())
    assert exc.value.detail == "Invalid access token."


def test_protected_route_requires_token(client):
    response = client.post(
        "/v1/users/invitations",
        json={
            "email": "new@example.com",
            "full_name": "New User",
            "role": "teacher",
        },
    )
    assert response.status_code == 401
    assert response.headers.get("www-authenticate") == "Bearer"


def test_protected_route_rejects_a_garbage_token(client):
    response = client.post(
        "/v1/users/invitations",
        headers={"Authorization": "Bearer not.a.jwt"},
        json={
            "email": "new@example.com",
            "full_name": "New User",
            "role": "teacher",
        },
    )
    assert response.status_code == 401
