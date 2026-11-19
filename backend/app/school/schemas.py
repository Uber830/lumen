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


__all__ = [
    "AdminSchoolOut",
    "AdminUserOut",
    "CurrentPeriodOut",
    "SchoolAdminMe",
]
