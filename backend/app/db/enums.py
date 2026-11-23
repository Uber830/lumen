"""Enum types mirroring the Postgres enums declared in the migrations.

Each value here has a one-to-one counterpart in the `create type`
statements under db/migrations/. The SQLAlchemy Enum uses the
*value* names, which are the ones stored in Postgres, and renders them
as native Postgres enum types on create.

Keeping them in one module makes it easy to diff against the
migrations when the schema changes.
"""

from __future__ import annotations

from enum import StrEnum

from sqlalchemy import Enum as SAEnum


def pg_enum(enum_cls: type[StrEnum], name: str) -> SAEnum:
    """Build a native Postgres enum column type.

    `name` is the Postgres type name; it must match the `create type`
    statement in the migrations so SQLAlchemy reuses the existing type
    instead of trying to create a new one.
    """
    return SAEnum(
        enum_cls,
        name=name,
        native_enum=True,
        values_callable=lambda e: [m.value for m in e],
    )


class SchoolRole(StrEnum):
    """Role of a user inside a school.

    Mirrors the `school_role` enum.
    """

    SCHOOL_ADMIN = "school_admin"
    TEACHER = "teacher"
    STUDENT = "student"


class SchoolAdminRole(StrEnum):
    """The rank of a school administrator.

    Mirrors the `school_admin_role` enum. The principal runs the
    school: it closes the academic periods, invites the rest of the
    team and changes the identity of the school. The secundario helps
    with the community and the academic structure.
    """

    PRINCIPAL = "principal"
    SECUNDARIO = "secundario"


class DeliveryModality(StrEnum):
    """How the teaching of a period is given.

    Mirrors the `delivery_modality` enum. It is not the length of the
    cycle, which lives in `academic_period_modality`.
    """

    PRESENCIAL = "presencial"
    VIRTUAL = "virtual"
    HIBRIDA = "hibrida"


class PlatformRoleKind(StrEnum):
    """Global roles that are not tied to a school.

    Mirrors the `platform_role_kind` enum.
    """

    PLATFORM_ADMIN = "platform_admin"


class SchoolStatus(StrEnum):
    """Lifecycle status of a tenant.

    Mirrors the `school_status` enum.
    """

    ACTIVE = "active"
    TRIAL = "trial"
    SUSPENDED = "suspended"


class PlanInterval(StrEnum):
    """Billing interval of a plan.

    Mirrors the `plan_interval` enum.
    """

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class AcademicPeriodModality(StrEnum):
    """Shape of an academic period.

    Mirrors the `academic_period_modality` enum.
    """

    BIMESTRE = "bimestre"
    TRIMESTRE = "trimestre"
    SEMESTRE = "semestre"
    ANUAL = "anual"


class EnrollmentStatus(StrEnum):
    """State of a student's enrollment.

    Mirrors the `enrollment_status` enum.
    """

    ACTIVE = "active"
    WITHDRAWN = "withdrawn"
    COMPLETED = "completed"


class ContentKind(StrEnum):
    """Type of material posted to a course subject.

    Mirrors the `content_kind` enum.
    """

    DOCUMENT = "document"
    VIDEO = "video"
    LINK = "link"
    TEXT = "text"


class TaskSubmissionStatus(StrEnum):
    """State of a student's submission.

    Mirrors the `task_submission_status` enum.
    """

    DRAFT = "draft"
    SUBMITTED = "submitted"
    GRADED = "graded"
    RETURNED = "returned"


class ChatConversationKind(StrEnum):
    """Type of chat conversation.

    Mirrors the `chat_conversation_kind` enum.
    """

    DIRECT = "direct"
    GROUP = "group"


class SubscriptionStatus(StrEnum):
    """Lifecycle of a subscription.

    Mirrors the `subscription_status` enum.
    """

    PENDING = "pending"
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    TRIAL = "trial"


class BillingInterval(StrEnum):
    """Billing interval of a subscription.

    Mirrors the `billing_interval` enum.
    """

    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class EvaluationKind(StrEnum):
    """Type of evaluation question.

    Mirrors the `evaluation_kind` enum.
    """

    MULTIPLE_CHOICE = "multiple_choice"
    TRUE_FALSE = "true_false"
    OPEN = "open"


class EvaluationAttemptStatus(StrEnum):
    """Lifecycle of an evaluation attempt.

    Mirrors the `evaluation_attempt_status` enum.
    """

    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"
    EXPIRED = "expired"


class IcfesAttemptStatus(StrEnum):
    """Lifecycle of an ICFES attempt.

    Mirrors the `icfes_attempt_status` enum.
    """

    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"


class NotificationKind(StrEnum):
    """What a notification is about.

    Mirrors the `notification_kind` enum. The frontend maps it to an
    icon and a wording; the backend fills in the title, the body and
    the link.
    """

    TASK_ASSIGNED = "task_assigned"
    TASK_SUBMITTED = "task_submitted"
    TASK_GRADED = "task_graded"
    CONTENT_PUBLISHED = "content_published"
    CHAT_MESSAGE = "chat_message"


__all__ = [
    "AcademicPeriodModality",
    "BillingInterval",
    "ChatConversationKind",
    "ContentKind",
    "DeliveryModality",
    "EnrollmentStatus",
    "EvaluationAttemptStatus",
    "EvaluationKind",
    "IcfesAttemptStatus",
    "NotificationKind",
    "PlanInterval",
    "PlatformRoleKind",
    "SchoolAdminRole",
    "SchoolRole",
    "SchoolStatus",
    "SubscriptionStatus",
    "TaskSubmissionStatus",
    "pg_enum",
]
