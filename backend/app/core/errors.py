"""Domain exceptions and their HTTP mapping.

The routers raise these instead of `HTTPException` so that the domain
layer stays independent of FastAPI. A single exception handler
registered in `main.py` translates them into responses, which keeps
the error format consistent across every endpoint.

Status code conventions:

- 400 — the request is malformed in a way Pydantic could not catch.
- 401 — the caller is not authenticated (no token, expired token).
- 403 — the caller is authenticated but not allowed to do this.
- 404 — the resource does not exist, or the caller may not know that
  it exists (both cases are deliberately indistinguishable, so that
  probing for other tenants' ids returns 404 rather than 403).
- 409 — the request conflicts with the current state (duplicate email,
  short code already taken).
- 422 — the payload failed validation.
- 502 — an upstream provider (Wompi, Supabase Storage) failed.
- 503 — the service is unavailable: missing configuration, or the
  database is not answering. Retrying may work.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    """Base class for every domain error."""

    status_code: int = 400
    code: str = "bad_request"

    def __init__(
        self,
        detail: str,
        *,
        code: str | None = None,
        status_code: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        if code is not None:
            self.code = code
        if status_code is not None:
            self.status_code = status_code
        self.extra = extra or {}

    def to_payload(self) -> dict[str, Any]:
        """The JSON body sent to the client."""
        payload: dict[str, Any] = {"detail": self.detail, "code": self.code}
        payload.update(self.extra)
        return payload


class AuthenticationError(AppError):
    """The caller could not be authenticated."""

    status_code = 401
    code = "unauthorized"


class PermissionError_(AppError):
    """The caller is authenticated but lacks the required role."""

    status_code = 403
    code = "forbidden"


# Exported under a non-conflicting name: `PermissionError` shadows the
# builtin, and `from app.core.errors import PermissionError` would be a
# footgun.
ForbiddenError = PermissionError_


class NotFoundError(AppError):
    """The resource does not exist, or is invisible to the caller."""

    status_code = 404
    code = "not_found"


class ConflictError(AppError):
    """The request conflicts with the current state."""

    status_code = 409
    code = "conflict"


class ValidationError(AppError):
    """The payload is semantically invalid."""

    status_code = 422
    code = "unprocessable_entity"


class UpstreamError(AppError):
    """An external provider failed."""

    status_code = 502
    code = "bad_gateway"


class ServiceUnavailableError(AppError):
    """The service cannot serve the request right now.

    Configuration and infrastructure, not the caller: a missing
    database URL, or Postgres refusing connections. The caller is not
    at fault and a retry may work once the service recovers.
    """

    status_code = 503
    code = "service_unavailable"


__all__ = [
    "AppError",
    "AuthenticationError",
    "ConflictError",
    "ForbiddenError",
    "NotFoundError",
    "PermissionError_",
    "ServiceUnavailableError",
    "UpstreamError",
    "ValidationError",
]
