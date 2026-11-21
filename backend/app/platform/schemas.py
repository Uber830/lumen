"""Pydantic request/response models for the platform router."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.schools.operations import DEFAULT_TRIAL_DAYS


class ProvisionSchoolRequest(BaseModel):
    """Body for POST /v1/platform/schools.

    The school and the administrator that will run it. The
    administrator's account is created pending: it sets its password
    through the activation link that comes with the response.
    """

    school_name: str = Field(min_length=2, max_length=120)
    short_code: str = Field(min_length=2, max_length=16)
    # The plans are not managed yet: when the team does not pick one,
    # the school starts with the default plan.
    plan_code: str | None = Field(default=None, max_length=64)
    admin_email: EmailStr
    admin_name: str = Field(min_length=2, max_length=120)
    trial_days: int = Field(default=DEFAULT_TRIAL_DAYS, ge=1, le=365)
    # Where the school is. It is optional: a school that does not
    # report it simply does not show it.
    city: str | None = Field(default=None, max_length=120)

    @field_validator("school_name", "short_code", "admin_name")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("must not be blank")
        return value

    @field_validator("plan_code")
    @classmethod
    def _strip_plan(cls, value: str | None) -> str | None:
        """The plan is optional: a blank one is no plan."""
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("city")
    @classmethod
    def _strip_city(cls, value: str | None) -> str | None:
        """The city is optional: a blank one is no city."""
        if value is None:
            return None
        value = value.strip()
        return value or None


class ProvisionSchoolResponse(BaseModel):
    """The school that was created and the activation of its admin."""

    school_id: UUID
    admin_user_id: UUID
    admin_email: EmailStr
    activation_token: str
    activation_expires_at: datetime


__all__ = [
    "ProvisionSchoolRequest",
    "ProvisionSchoolResponse",
]
