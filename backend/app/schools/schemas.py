"""Pydantic request/response models for the schools router."""

from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel, Field, field_validator

# How many pictures the gallery can hold. It is a short list: the
# dashboard shows them in one row of a screen.
MAX_GALLERY_IMAGES = 5


class SchoolGalleryImage(BaseModel):
    """One picture of the school's gallery."""

    url: str = Field(max_length=2048)
    caption: str | None = Field(default=None, max_length=200)

    @field_validator("caption")
    @classmethod
    def _trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


class SchoolOut(BaseModel):
    """A school's profile, including its branding."""

    id: UUID
    name: str
    short_code: str
    status: str
    display_name: str | None = None
    logo_url: str | None = None
    primary_color: str | None = None
    # The institutional identity shown in the dashboard.
    mission: str | None = None
    vision: str | None = None
    banner_url: str | None = None
    gallery: list[SchoolGalleryImage] = Field(default_factory=list)


class SchoolUpdateRequest(BaseModel):
    """Body for PATCH /v1/schools/me.

    Only branding is editable: the name and short code are the unique
    identity set at signup. Every field is optional; a sent null clears
    it, an omitted field is left untouched.
    """

    display_name: str | None = Field(default=None, max_length=120)
    logo_url: str | None = Field(default=None, max_length=2048)
    primary_color: str | None = Field(default=None, max_length=64)
    mission: str | None = Field(default=None, max_length=1000)
    vision: str | None = Field(default=None, max_length=1000)
    banner_url: str | None = Field(default=None, max_length=2048)
    gallery: list[SchoolGalleryImage] | None = Field(default=None, max_length=MAX_GALLERY_IMAGES)

    @field_validator("display_name")
    @classmethod
    def _trim(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("mission", "vision")
    @classmethod
    def _trim_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None


__all__ = [
    "MAX_GALLERY_IMAGES",
    "SchoolGalleryImage",
    "SchoolOut",
    "SchoolUpdateRequest",
]
