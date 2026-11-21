"""The shapes of the school administrator's API."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class AdminUserOut(BaseModel):
    """The administrator's own account."""

    id: uuid.UUID
    email: str
    full_name: str | None = None
    phone: str | None = None
    avatar_url: str | None = None


class AdminSchoolOut(BaseModel):
    """The school the administrator runs.

    The plan is read, never changed: the admin sees which plan the
    school is on, but the subscription belongs to the platform team.
    """

    id: uuid.UUID
    name: str
    display_name: str | None = None
    short_code: str
    status: str
    logo_url: str | None = None
    primary_color: str | None = None
    plan_code: str | None = None
    plan_name: str | None = None


class CurrentPeriodOut(BaseModel):
    """The academic period the school is in."""

    id: uuid.UUID
    name: str
    start_date: date
    end_date: date
    # How the teaching is given: presencial, virtual or hibrida.
    delivery_modality: str | None = None
    closed_at: datetime | None = None


class SchoolAdminMe(BaseModel):
    """Everything the panel needs to know about the caller.

    `permissions` is the contract with the frontend: it decides what
    the interface shows. The frontend never decides on its own what a
    rank may do, and an action that is not allowed is disabled **with
    its reason**, not hidden.
    """

    user: AdminUserOut
    # principal or secundario. None when the caller is not an
    # administrator.
    admin_role: str | None = None
    school: AdminSchoolOut
    permissions: list[str] = Field(default_factory=list)
    current_period: CurrentPeriodOut | None = None


class MaterialAreaCount(BaseModel):
    """How much enabled material there is in one area."""

    area: str
    count: int


class MaterialOverview(BaseModel):
    """The material of the school.

    `catalog_total` is the size of the whole editorial catalog. The
    school is told how much of it it has, because the catalog is
    published on the public site.
    """

    available: int
    catalog_total: int
    by_area: list[MaterialAreaCount] = Field(default_factory=list)
    last_enabled_at: datetime | None = None


class TeachersOverview(BaseModel):
    """The community of teachers.

    `with_access` counts the teachers with at least one assignment:
    the assignment is what opens the material of a course.
    """

    total: int
    with_access: int
    pending: int


class StudentsOverview(BaseModel):
    """The students of the school."""

    total: int
    with_access: int
    courses: int


class TasksOverview(BaseModel):
    """The work waiting for the school."""

    pending: int
    stale: int


class PeriodOverview(BaseModel):
    """The period the school is in."""

    id: str
    name: str
    start_date: str
    end_date: str


class ActivityEntry(BaseModel):
    """One event of the recent activity of the school."""

    # The icon the interface draws: upload, layers, users or link.
    icon: str
    # The accent of the icon: success, info, teal or muted.
    tone: str
    title: str
    detail: str
    at: datetime


class MaterialCourseOut(BaseModel):
    """One course of the school a material applies to."""

    id: str
    name: str


class MaterialListItem(BaseModel):
    """One piece of the enabled material."""

    id: str
    # The short code shown in the table: C-1041.
    ref: str
    title: str
    description: str | None = None
    area: str
    kind: str
    file_size_bytes: int | None = None
    # When the platform enabled it for this school.
    available_since: datetime
    courses: list[MaterialCourseOut] = Field(default_factory=list)


class MaterialPage(BaseModel):
    """A page of the material of the school.

    The page comes from the server: the catalog of the platform is
    never pulled into the browser to be filtered there.
    """

    items: list[MaterialListItem] = Field(default_factory=list)
    total: int = 0
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=6, ge=1)
    pages: int = Field(default=0, ge=0)
    # The areas the school can filter by.
    areas: list[str] = Field(default_factory=list)


class MaterialAccess(BaseModel):
    """The access of the school to a material.

    The panel shows it as a confirmation. The switches that enable the
    material belong to the platform team, not to the school.
    """

    confirmed: bool
    enabled_at: datetime
    note: str


class MaterialDetailOut(MaterialListItem):
    """One material, with its access confirmed."""

    access: MaterialAccess


class SchoolOverview(BaseModel):
    """The whole dashboard of the school, in one call.

    The dashboard is the view that suffers the most in mobile, so it
    asks for everything at once instead of four round trips.
    """

    material: MaterialOverview
    teachers: TeachersOverview
    students: StudentsOverview
    tasks: TasksOverview
    courses: int
    period: PeriodOverview | None = None
    activity: list[ActivityEntry] = Field(default_factory=list)


__all__ = [
    "ActivityEntry",
    "AdminSchoolOut",
    "AdminUserOut",
    "CurrentPeriodOut",
    "MaterialAccess",
    "MaterialAreaCount",
    "MaterialCourseOut",
    "MaterialDetailOut",
    "MaterialListItem",
    "MaterialOverview",
    "MaterialPage",
    "PeriodOverview",
    "SchoolAdminMe",
    "SchoolOverview",
    "StudentsOverview",
    "TeachersOverview",
    "TasksOverview",
]


class TeacherListItem(BaseModel):
    """One teacher of the school, with its access to the content."""

    membership_id: str
    user_id: str
    full_name: str | None = None
    email: str | None = None
    joined_at: datetime
    revoked_at: datetime | None = None
    account_activated: bool = False
    # The courses the teacher teaches and the subjects of each one.
    courses: list[str] = Field(default_factory=list)
    subjects: list[str] = Field(default_factory=list)
    # `activado` or `pendiente`: one signal, not two loose badges.
    access: str = "pendiente"
    # Why the access is pending, in the words of the panel.
    access_reason: str | None = None
    # `activo` or `inactivo`: whether the member belongs to the school.
    status: str = "activo"


class StudentListItem(BaseModel):
    """One student of the school, with its course and its average."""

    membership_id: str
    user_id: str
    full_name: str | None = None
    email: str | None = None
    joined_at: datetime
    revoked_at: datetime | None = None
    account_activated: bool = False
    courses: list[str] = Field(default_factory=list)
    # `null` when the student has no grades: it is not a zero.
    average: float | None = None
    access: str = "pendiente"
    access_reason: str | None = None
    status: str = "activo"


class MemberPage(BaseModel):
    """A page of the community of the school.

    The page comes from the server: the list is never pulled into the
    browser to be filtered there.
    """

    items: list[TeacherListItem | StudentListItem] = Field(default_factory=list)
    total: int = 0
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=10, ge=1)
    pages: int = Field(default=0, ge=0)


