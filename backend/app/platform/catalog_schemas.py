"""The Pydantic models of the catalog endpoints.

The request bodies validate the closed catalogs of the module (types,
areas, grades), so a material can never carry a value that the
frontend was never offered.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.platform.catalog import (
    MATERIAL_AREAS,
    MATERIAL_GRADES,
    MATERIAL_STATUSES,
    MATERIAL_TYPES,
    VISIBLE_TO,
)


def _one_of(value: str, allowed: tuple[str, ...], field: str) -> str:
    """Check a value against a closed catalog."""
    value = value.strip()
    if value not in allowed:
        raise ValueError(f"{field} must be one of: {', '.join(allowed)}")
    return value


class SchoolRef(BaseModel):
    """A school, as the catalog shows it."""

    id: UUID
    name: str


class MaterialSummary(BaseModel):
    """One row of the catalog listing."""

    id: UUID
    code: str
    title: str
    type: str
    area: str
    grades: list[str] = Field(default_factory=list)
    status: str
    origin: str
    visible_to: str
    size_label: str
    updated_at: datetime
    # The first schools with access. The rest is counted in
    # `schools_extra`, which the backend computes.
    schools: list[SchoolRef] = Field(default_factory=list)
    schools_extra: int = 0


class MaterialFileOut(BaseModel):
    """One file of a material."""

    id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    size_label: str
    is_primary: bool
    created_at: datetime


class MaterialSchoolOut(BaseModel):
    """A school that can see a material."""

    id: UUID
    name: str
    short_code: str
    plan: str | None = None
    students: int = 0


class HistoryEntryOut(BaseModel):
    """One entry of the history of a material."""

    id: UUID
    action: str
    detail: dict[str, Any] = Field(default_factory=dict)
    actor_id: UUID | None = None
    actor_name: str | None = None
    created_at: datetime


class MaterialDetail(BaseModel):
    """The whole material, as the side panel shows it."""

    id: UUID
    code: str
    title: str
    type: str
    area: str
    grades: list[str] = Field(default_factory=list)
    visible_to: str
    publication_year: int | None = None
    description: str | None = None
    origin: str
    external_url: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None = None
    archived_at: datetime | None = None
    size_label: str
    files: list[MaterialFileOut] = Field(default_factory=list)
    schools: list[MaterialSchoolOut] = Field(default_factory=list)
    history: list[HistoryEntryOut] = Field(default_factory=list)
    # The states the material can move to, decided by the backend.
    available_transitions: list[str] = Field(default_factory=list)
    # What it still needs to be published. Empty when it can be.
    missing: list[str] = Field(default_factory=list)


class CreateMaterialRequest(BaseModel):
    """The body of POST /v1/platform/catalog."""

    # The title may be blank: the name of the uploaded file proposes
    # one when the platform team does not write it.
    title: str = Field(default="", max_length=240)
    type: str
    area: str
    grades: list[str] = Field(default_factory=list)
    visible_to: str = "all"
    publication_year: int | None = Field(default=None, ge=1900, le=2200)
    description: str | None = Field(default=None, max_length=2000)
    origin: str = "upload"
    external_url: str | None = Field(default=None, max_length=1000)
    # The schools that will have access from the start.
    school_ids: list[UUID] = Field(default_factory=list)
    # The file that was uploaded before. Required when the origin is an
    # upload.
    file_id: UUID | None = None

    @field_validator("type")
    @classmethod
    def _check_type(cls, value: str) -> str:
        return _one_of(value, MATERIAL_TYPES, "type")

    @field_validator("area")
    @classmethod
    def _check_area(cls, value: str) -> str:
        return _one_of(value, MATERIAL_AREAS, "area")

    @field_validator("grades")
    @classmethod
    def _check_grades(cls, value: list[str]) -> list[str]:
        return [_one_of(grade, MATERIAL_GRADES, "grades") for grade in value]

    @field_validator("visible_to")
    @classmethod
    def _check_visible_to(cls, value: str) -> str:
        return _one_of(value, VISIBLE_TO, "visible_to")

    @field_validator("origin")
    @classmethod
    def _check_origin(cls, value: str) -> str:
        return _one_of(value, ("upload", "link"), "origin")

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        return value.strip()


class PatchMaterialRequest(BaseModel):
    """The body of PATCH /v1/platform/catalog/{id}.

    It edits the metadata only. The state and the access have their
    own endpoints, so that the history says exactly what changed.
    """

    title: str | None = Field(default=None, min_length=1, max_length=240)
    type: str | None = None
    area: str | None = None
    grades: list[str] | None = None
    visible_to: str | None = None
    publication_year: int | None = Field(default=None, ge=1900, le=2200)
    description: str | None = Field(default=None, max_length=2000)

    @field_validator("type")
    @classmethod
    def _check_type(cls, value: str | None) -> str | None:
        return None if value is None else _one_of(value, MATERIAL_TYPES, "type")

    @field_validator("area")
    @classmethod
    def _check_area(cls, value: str | None) -> str | None:
        return None if value is None else _one_of(value, MATERIAL_AREAS, "area")

    @field_validator("grades")
    @classmethod
    def _check_grades(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return [_one_of(grade, MATERIAL_GRADES, "grades") for grade in value]

    @field_validator("visible_to")
    @classmethod
    def _check_visible_to(cls, value: str | None) -> str | None:
        return None if value is None else _one_of(value, VISIBLE_TO, "visible_to")


class StatusRequest(BaseModel):
    """The body of POST /v1/platform/catalog/{id}/status."""

    status: str

    @field_validator("status")
    @classmethod
    def _check_status(cls, value: str) -> str:
        return _one_of(value, MATERIAL_STATUSES, "status")


class SetSchoolsRequest(BaseModel):
    """The body of PUT /v1/platform/catalog/{id}/schools."""

    # The complete set of schools that will have access.
    school_ids: list[UUID] = Field(default_factory=list)
    # The client sets it when the user confirmed that a published
    # material loses the access of a school.
    confirm: bool = False


class UploadResponse(BaseModel):
    """The answer of POST /v1/platform/uploads."""

    file_id: UUID
    file_name: str
    size_bytes: int
    size_label: str
    mime_type: str
    # The material the file already belongs to, when it is a duplicate.
    duplicate_of: dict[str, str] | None = None


class CatalogPage(BaseModel):
    """A page of the catalog listing."""

    items: list[MaterialSummary] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    per_page: int = 8


class SchoolCoverage(BaseModel):
    """How much of the catalog a school can see."""

    school_id: UUID
    name: str
    short_code: str
    status: str
    plan: str | None = None
    students: int = 0
    teachers: int = 0
    covered: int = 0
    total: int = 0


class SchoolSummary(BaseModel):
    """One row of the schools listing."""

    id: UUID
    name: str
    short_code: str
    city: str | None = None
    status: str
    plan: str | None = None
    students: int = 0
    teachers: int = 0
    covered: int = 0
    total: int = 0


class SchoolCatalogItem(BaseModel):
    """One material of the catalog, as the school drawer shows it.

    `enabled` says whether the school can see it right now.
    """

    id: UUID
    code: str
    title: str
    type: str
    area: str
    status: str
    enabled: bool


class SchoolDetail(BaseModel):
    """One school with its figures and its coverage of the catalog."""

    id: UUID
    name: str
    short_code: str
    city: str | None = None
    status: str
    plan: str | None = None
    students: int = 0
    teachers: int = 0
    covered: int = 0
    total: int = 0
    catalog: list[SchoolCatalogItem] = Field(default_factory=list)


class SchoolPage(BaseModel):
    """A page of the schools listing."""

    items: list[SchoolSummary] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    per_page: int = 8


class MetricsResponse(BaseModel):
    """The figures of the global panel."""

    schools: int = 0
    teachers: int = 0
    students: int = 0
    materials: int = 0
    materials_by_status: dict[str, int] = Field(default_factory=dict)
    materials_by_area: dict[str, int] = Field(default_factory=dict)
    school_coverage: list[SchoolCoverage] = Field(default_factory=list)


class AuditEntryOut(BaseModel):
    """One event of the audit trail."""

    id: UUID
    event_type: str
    level: str
    actor_id: UUID | None = None
    actor_name: str | None = None
    school_id: UUID | None = None
    subject_type: str | None = None
    subject_id: UUID | None = None
    detail: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class AuditPage(BaseModel):
    """A page of the audit trail."""

    items: list[AuditEntryOut] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    per_page: int = 8


class CatalogOptions(BaseModel):
    """The closed catalogs the frontend needs."""

    types: list[str] = Field(default_factory=list)
    areas: list[str] = Field(default_factory=list)
    grades: list[str] = Field(default_factory=list)
    statuses: list[str] = Field(default_factory=list)
    visible_to: list[str] = Field(default_factory=list)
    plans: list[dict[str, str]] = Field(default_factory=list)


__all__ = [
    "SchoolCatalogItem",
    "SchoolDetail",
    "AuditEntryOut",
    "AuditPage",
    "CatalogOptions",
    "CatalogPage",
    "CreateMaterialRequest",
    "HistoryEntryOut",
    "MaterialDetail",
    "MaterialFileOut",
    "MaterialSchoolOut",
    "MaterialSummary",
    "MetricsResponse",
    "PatchMaterialRequest",
    "SchoolCoverage",
    "SchoolPage",
    "SchoolRef",
    "SchoolSummary",
    "SetSchoolsRequest",
    "StatusRequest",
    "UploadResponse",
]
