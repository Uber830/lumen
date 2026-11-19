"""SQLAlchemy models for the Lumen schema.

Importing this package registers every model on the shared `Base`
metadata, which is what Alembic autogenerate and `Base.metadata` rely
on.

The modules are grouped by domain:

- `identity`   — users, profiles, platform roles, schools, memberships, plans.
- `academics`  — periods, courses, subjects, assignments, enrollments.
- `learning`   — content, tasks, submissions, grades.
- `chat`       — conversations, members, messages.
- `evaluations`— authored assessments and their attempts.
- `icfes`      — the question bank, simulations and attempts.
- `billing`    — subscriptions, entitlements, the Wompi ledger.
- `catalog`    — the editorial catalog of the platform role: materials,
                 their files, their access, their history and the audit trail.
- `sessions`   — refresh tokens, password resets, email verifications.
- `notifications` — the in-app notifications of each user.
"""

from __future__ import annotations

from app.db.base import Base
from app.db.models.academics import (
    AcademicPeriod,
    Course,
    CourseSubject,
    StudentEnrollment,
    Subject,
    TeacherAssignment,
)
from app.db.models.billing import Entitlement, Subscription, WompiEventProcessed
from app.db.models.catalog import (
    AuditLog,
    Material,
    MaterialFile,
    MaterialHistory,
    MaterialSchool,
)
from app.db.models.chat import ChatConversation, ChatMember, ChatMessage
from app.db.models.evaluations import (
    Evaluation,
    EvaluationAnswer,
    EvaluationAnswerKey,
    EvaluationAttempt,
    EvaluationQuestion,
)
from app.db.models.icfes import (
    IcfesAnswer,
    IcfesAnswerKey,
    IcfesAttempt,
    IcfesQuestion,
    IcfesScore,
    IcfesSimulation,
    IcfesSimulationQuestion,
)
from app.db.models.identity import (
    Plan,
    PlatformRole,
    Profile,
    School,
    SchoolMembership,
    User,
)
from app.db.models.learning import (
    ContentItem,
    ContentProgress,
    Grade,
    Task,
    TaskSubmission,
)
from app.db.models.notifications import Notification, NotificationPreference
from app.db.models.sessions import (
    EmailVerificationToken,
    LoginAttempt,
    PasswordResetToken,
    RefreshToken,
)
from app.db.models.site import CatalogItem, CatalogItemSchool, SiteContent

__all__ = [
    "AcademicPeriod",
    "AuditLog",
    "Base",
    "CatalogItem",
    "CatalogItemSchool",
    "ChatConversation",
    "ChatMember",
    "ChatMessage",
    "ContentItem",
    "ContentProgress",
    "Course",
    "CourseSubject",
    "Entitlement",
    "Evaluation",
    "EvaluationAnswer",
    "EvaluationAnswerKey",
    "EvaluationAttempt",
    "EvaluationQuestion",
    "Grade",
    "IcfesAnswer",
    "IcfesAnswerKey",
    "IcfesAttempt",
    "IcfesQuestion",
    "IcfesScore",
    "IcfesSimulation",
    "IcfesSimulationQuestion",
    "LoginAttempt",
    "Material",
    "MaterialFile",
    "MaterialHistory",
    "MaterialSchool",
    "Notification",
    "NotificationPreference",
    "Plan",
    "PlatformRole",
    "Profile",
    "RefreshToken",
    "PasswordResetToken",
    "EmailVerificationToken",
    "School",
    "SchoolMembership",
    "SiteContent",
    "StudentEnrollment",
    "Subject",
    "Subscription",
    "Task",
    "TaskSubmission",
    "TeacherAssignment",
    "User",
    "WompiEventProcessed",
]
