"""Cookie helpers for the auth endpoints.

The browser's tokens live in httpOnly cookies: the page's JavaScript
cannot read them, so an XSS cannot steal them. The browser sends them
with `credentials: "include"`, and the API reads them.

The server functions run on the server. They read the cookie from the
incoming request and forward it as an `Authorization: Bearer` header,
which is why the API accepts both.

`SameSite=Lax` is enough: the frontend and the API are on the same
site (different ports in development, different subdomains in
production), and a Lax cookie is sent on every same-site request.
"""

from __future__ import annotations

from fastapi import Response

from app.config import Settings, get_settings


def set_auth_cookies(
    response: Response,
    *,
    access_token: str,
    refresh_token: str,
    settings: Settings | None = None,
) -> None:
    """Store the tokens in the browser's cookies."""
    cfg = settings or get_settings()
    secure = cfg.is_production
    # An empty domain means a host-only cookie, which is the default.
    domain = cfg.cookie_domain or None

    response.set_cookie(
        key="lumen_access",
        value=access_token,
        max_age=cfg.access_token_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
        domain=domain,
    )
    response.set_cookie(
        key="lumen_refresh",
        value=refresh_token,
        max_age=cfg.refresh_token_ttl_seconds,
        httponly=True,
        samesite="lax",
        secure=secure,
        path="/",
        domain=domain,
    )


def clear_auth_cookies(response: Response) -> None:
    """Remove the tokens from the browser's cookies."""
    response.delete_cookie(key="lumen_access", path="/")
    response.delete_cookie(key="lumen_refresh", path="/")


__all__ = ["clear_auth_cookies", "set_auth_cookies"]
