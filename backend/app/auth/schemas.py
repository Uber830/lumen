"""Pydantic request/response models for the auth router.

These are the contract between the backend and the frontend. The
frontend migrates to them in Phase 4; until then it keeps using
Supabase Auth.

Error responses use the shape the frontend already knows how to read:

    {"detail": "<human readable message>", "code": "<machine code>"}

The `code` is stable and can be branched on; the `detail` is meant to
be shown to the user.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schools.schemas import SchoolGalleryImage


class LoginRequest(BaseModel):
    """Body for POST /v1/auth/login."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    # Keep the session in this browser. It does not make the refresh
    # token last longer: it only stops the browser from forgetting it.
    remember_me: bool = False


class RefreshRequest(BaseModel):
    """Body for POST /v1/auth/refresh.

    The refresh token may be empty: the browser sends it in an
    httpOnly cookie it cannot read, so it posts an empty body and the
    endpoint falls back to the cookie.
    """

    refresh_token: str = Field(default="", max_length=512)


class LogoutRequest(BaseModel):
    """Body for POST /v1/auth/logout.

    The refresh token is optional: logging out without it revokes
    every session of the caller.
    """

    refresh_token: str | None = Field(default=None, max_length=512)
    all_sessions: bool = False


class ForgotPasswordRequest(BaseModel):
    """Body for POST /v1/auth/forgot-password."""

    email: EmailStr


class ResetPasswordRequest(BaseModel):
    """Body for POST /v1/auth/reset-password."""

    token: str = Field(min_length=1, max_length=512)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def _check_password(cls, value: str) -> str:
        if value.strip() == "":
            raise ValueError("password must not be blank")
        return value


class TokenPair(BaseModel):
    """An access token plus the refresh token that renews it."""

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_at: datetime
    expires_in: int = Field(description="Access token lifetime in seconds.")


class MembershipInfo(BaseModel):
    """One of the schools a user belongs to."""

    id: UUID
    school_id: UUID
    role: str
    is_primary: bool
    joined_at: datetime


class ProfileInfo(BaseModel):
    """The domain profile of a user."""

    id: UUID
    full_name: str
    given_name: str | None = None
    family_name: str | None = None
    phone: str | None = None
    locale: str = "es-CO"
    avatar_url: str | None = None


class UpdateProfileRequest(BaseModel):
    """Body for PATCH /v1/auth/me.

    Every field is optional: only the ones actually sent are written,
    which is why the handler reads ``model_dump(exclude_unset=True)``
    rather than the attributes. A sent ``null`` clears the field; an
    omitted field leaves it untouched.

    ``email`` lives on the user, not the profile; changing it is
    guarded for uniqueness. ``avatar_url`` is set by the avatar upload
    flow after the image lands in Supabase Storage.
    """

    full_name: str | None = Field(default=None, max_length=120)
    given_name: str | None = Field(default=None, max_length=120)
    family_name: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    avatar_url: str | None = Field(default=None, max_length=2048)
    email: EmailStr | None = None

    @field_validator("full_name", "given_name", "family_name", "phone")
    @classmethod
    def _trim_to_none(cls, value: str | None) -> str | None:
        """Trim whitespace; an empty string becomes null (cleared)."""
        if value is None:
            return None
        trimmed = value.strip()
        return trimmed or None


class SchoolBranding(BaseModel):
    """The branding of the caller's school.

    It travels with the session so the app can paint itself with the
    school's colour and show its logo on the first frame, instead of
    using the default theme and repainting a second later. The mission,
    the vision and the pictures travel with it for the same reason: the
    dashboard shows them as soon as the page arrives.
    """

    id: UUID
    name: str
    display_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    mission: str | None = None
    vision: str | None = None
    banner_url: str | None = None
    gallery: list[SchoolGalleryImage] = Field(default_factory=list)


class SessionInfo(BaseModel):
    """The full context the frontend needs after signing in."""

    user: dict[str, Any]
    profile: ProfileInfo | None = None
    memberships: list[MembershipInfo] = Field(default_factory=list)
    platform_role: str | None = None
    primary_school_id: UUID | None = None
    # The branding of the primary school, when the caller belongs to one.
    school: SchoolBranding | None = None


class AuthResponse(BaseModel):
    """The response of register, login and refresh."""

    tokens: TokenPair
    session: SessionInfo
    # A short-lived token for Supabase Storage and Realtime. It is not
    # an authentication token: the API does not accept it. It is None
    # when the project JWT secret is not configured.
    supabase_token: str | None = None


class MessageResponse(BaseModel):
    """A simple acknowledgement with no payload."""

    message: str


__all__ = [
    "AuthResponse",
    "ForgotPasswordRequest",
    "LoginRequest",
    "LogoutRequest",
    "MembershipInfo",
    "MessageResponse",
    "ProfileInfo",
    "RefreshRequest",
    "ResetPasswordRequest",
    "SessionInfo",
    "TokenPair",
    "UpdateProfileRequest",
]
