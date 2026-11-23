"""Pydantic request/response models for the users router."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class SchoolRole(str, Enum):
    school_admin = "school_admin"
    teacher = "teacher"
    student = "student"

    # ruff: noqa: UP042 — SchoolRole is serialized as a string by FastAPI
    # and the str base keeps JSON encoders portable. Switch to StrEnum once
    # we drop Python 3.10/3.11 support.


class UserInvitationRequest(BaseModel):
    """Body for POST /v1/users/invitations.

    The school_id is optional: when omitted, the invitation is created
    against the requester's primary school. The requester must be a
    school_admin of that school.
    """

    email: EmailStr
    full_name: str = Field(min_length=2, max_length=120)
    role: SchoolRole
    school_id: UUID | None = None
    is_primary: bool = True
    # The courses a new student is enrolled in. A student without a
    # course has no material to see: the admin picks the course when it
    # creates the student.
    course_ids: list[UUID] | None = None
    # The course subjects a new teacher is assigned to. The assignment is
    # what gives the teacher access to the material of the subject.
    course_subject_ids: list[UUID] | None = None

    @field_validator("full_name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("full_name must not be blank")
        return value


class UserInvitationResponse(BaseModel):
    user_id: UUID
    email: EmailStr
    role: SchoolRole
    school_id: UUID
    membership_id: UUID
    # A single-use token the invited user redeems to set their first
    # password and activate the account. There is no email provider yet,
    # so the token is returned to the admin, who shares the activation
    # link with the new user. None when the user already had a password
    # (e.g. re-inviting someone who already activated).
    activation_token: str | None = None


class BulkInvitationsRequest(BaseModel):
    """Body for POST /v1/users/bulk-upload.

    The frontend parses a CSV file and posts the resulting rows as a
    single JSON array. The backend creates one Auth user per row.
    Failures are reported per row; the rest of the batch still runs.
    """

    invitations: list[UserInvitationRequest] = Field(min_length=1, max_length=500)


class BulkInvitationFailure(BaseModel):
    index: str
    email: EmailStr | None = None
    error: str


class BulkInvitationsResponse(BaseModel):
    created: list[UserInvitationResponse]
    failures: list[BulkInvitationFailure]


class MembershipUpdate(BaseModel):
    """Body for PATCH /v1/users/memberships/{membership_id}.

    Only ``revoked`` is supported for now: true deactivates the
    membership, false reactivates it.
    """

    revoked: bool


class MembershipResponse(BaseModel):
    membership_id: UUID
    school_id: UUID
    user_id: UUID
    role: SchoolRole
    revoked: bool


class ActivationLinkResponse(BaseModel):
    """The activation link of a member whose account is still pending."""

    membership_id: UUID
    user_id: UUID
    email: EmailStr
    # The one-time token the member redeems to set their password.
    activation_token: str
    # When the link stops working.
    expires_at: datetime
