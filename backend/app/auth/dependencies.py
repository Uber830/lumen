"""JWT verification and the FastAPI auth dependency.

The backend is the only issuer of authentication tokens. There is no
legacy path: a token is either signed by this backend with
`JWT_SECRET`, or it is not accepted.

The verification checks four things:

- the signature (HS256 with the configured secret);
- the expiry (`exp` is required);
- the issuer (`iss` must match `Settings.jwt_issuer`);
- the audience (`aud` must match `Settings.jwt_audience`).

All four are required. Accepting a token that only satisfies some of
them would allow a token minted for another service to be replayed
here.

**Where the token comes from.** Two places, in this order:

- the `Authorization: Bearer` header. The server functions use this:
  they read the cookie from the incoming request and forward it.
- the `lumen_access` cookie. The browser uses this: a cookie is
  httpOnly, so the page's JavaScript cannot read it, and a
  `fetch` with `credentials: "include"` sends it automatically.

This module proves identity. It does not authorize: the permission
layer (Phase 2) decides what the user may do.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWTError

from app.config import Settings, get_settings

# The cookie the browser's access token lives in.
ACCESS_COOKIE = "lumen_access"
# The cookie the browser's refresh token lives in.
REFRESH_COOKIE = "lumen_refresh"


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """The identity of the requester, as derived from the access token."""

    user_id: str
    email: str | None


def _extract_bearer(request: Request) -> str | None:
    """Return the bearer token from the Authorization header, if any."""
    auth_header = request.headers.get("authorization")
    if not auth_header:
        return None
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        return None
    return parts[1].strip()


def _extract_token(request: Request) -> str | None:
    """Return the access token, from the header or from the cookie."""
    token = _extract_bearer(request)
    if token is not None:
        return token
    return request.cookies.get(ACCESS_COOKIE) or None


def verify_access_token(token: str, settings: Settings) -> CurrentUser:
    """Verify a bearer token and return the requester.

    Raises HTTPException(401) when the token is invalid, expired,
    signed with the wrong key, or issued for another audience.
    """
    try:
        claims = jwt.decode(
            token,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
            options={"require": ["exp", "sub", "iss", "aud"]},
        )
    except PyJWTError as exc:
        # The reason is not echoed back to the client: it would tell
        # an attacker which part of the token was wrong.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    sub = claims.get("sub")
    if not isinstance(sub, str) or not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    email = claims.get("email")
    if email is not None and not isinstance(email, str):
        email = None

    return CurrentUser(user_id=sub, email=email)


def optional_current_user(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser | None:
    """The requester, when there is one.

    The routes that serve a public file use this: a photo of profile
    is read by a browser that may not carry the session (a message
    shared in another application, for instance). A missing or invalid
    token is not an error here: the route decides what to do without
    a session.
    """
    token = _extract_token(request)
    if token is None:
        return None
    try:
        return verify_access_token(token, settings)
    except HTTPException:
        return None


def get_current_user(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> CurrentUser:
    """FastAPI dependency that returns the authenticated user.

    Routes depending on this require a valid Bearer token. Routes that
    should be public (e.g. /health, /ready) do not include this
    dependency.
    """
    token = _extract_token(request)
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return verify_access_token(token, settings)
