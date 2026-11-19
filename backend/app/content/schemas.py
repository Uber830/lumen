"""Pydantic request/response models for the content router."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator, model_validator

from app.db.enums import ContentKind


class ContentItemBase(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    kind: ContentKind
    course_subject_id: uuid.UUID
    # The bucket path for a document, the external URL for a video or
    # a link, and the body for a text item.
    storage_path: str | None = Field(default=None, max_length=1024)
    external_url: str | None = Field(default=None, max_length=2048)
    body: str | None = Field(default=None, max_length=20000)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("title must not be blank")
        return value

    @field_validator("description", "external_url", "storage_path")
    @classmethod
    def _blank_to_none(cls, value: str | None) -> str | None:
        """An empty string is the same as not sending the field."""
        if value is None:
            return None
        value = value.strip()
        return value or None

    @model_validator(mode="after")
    def _check_shape(self) -> ContentItemBase:
        """Each kind needs its own field.

        This mirrors the `content_items_kind_check` constraint the
        migrations declare: a document has a storage path, a video
        has one or the other, a link has an external URL, and a text
        has a body.
        """
        match self.kind:
            case ContentKind.DOCUMENT:
                if not self.storage_path:
                    raise ValueError("a document requires storage_path")
            case ContentKind.VIDEO:
                if not self.storage_path and not self.external_url:
                    raise ValueError("a video requires storage_path or external_url")
            case ContentKind.LINK:
                if not self.external_url:
                    raise ValueError("a link requires external_url")
            case ContentKind.TEXT:
                if not self.body:
                    raise ValueError("a text item requires body")
        return self


class ContentItemCreate(ContentItemBase):
    pass


class ContentItemUpdate(BaseModel):
    """A partial update. Only the fields that are sent are written."""

    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    storage_path: str | None = Field(default=None, max_length=1024)
    external_url: str | None = Field(default=None, max_length=2048)
    body: str | None = Field(default=None, max_length=20000)


class ContentItemOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    course_subject_id: uuid.UUID
    posted_by: uuid.UUID
    title: str
    description: str | None
    kind: ContentKind
    storage_path: str | None
    external_url: str | None
    body: str | None
    posted_at: datetime
    created_at: datetime
    updated_at: datetime


class ContentProgressOut(BaseModel):
    id: uuid.UUID
    school_id: uuid.UUID
    content_item_id: uuid.UUID
    student_id: uuid.UUID
    completed_at: datetime
    created_at: datetime


__all__ = [
    "ContentItemCreate",
    "ContentItemOut",
    "ContentItemUpdate",
    "ContentProgressOut",
]
