"""Pydantic request/response models for the schools router."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SchoolOut(BaseModel):
    """A school's profile, including its branding."""

    id: UUID
    name: str
    short_code: str
    status: str
    display_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None


class SchoolUpdateRequest(BaseModel):
    """Body for PATCH /v1/schools/me.

    Only branding is editable: the name and short code are the unique
    identity set at signup. Every field is optional; a sent null clears
    it, an omitted field is left untouched.
    """

    display_name: str | None = Field(default=None, max_length=120)
    logo_url: str | None = Field(default=None, max_length=2048)
    primary_color: str | None = Field(default=None, max_length=64)

    @field_validator("display_name")
    @classmethod
    def _trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


__all__ = [
    "SchoolOut",
    "SchoolUpdateRequest",
]
