"""SQLAlchemy models for the Lumen schema.

Importing this package registers every model on the shared `Base`
metadata, which is what Alembic autogenerate and `Base.metadata` rely
on.

The modules are grouped by domain:

- `identity`   — users, profiles, platform roles, schools, memberships, plans.
- `materials`  — the editorial catalog and the schools it is enabled for.
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
    MaterialCourse,
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
    IcfesActivation,
    IcfesAnswer,
    IcfesAnswerKey,
    IcfesAttempt,
    IcfesQuestion,
    IcfesScore,
    IcfesSimulation,
    IcfesSimulationQuestion,
    IcfesSimulator,
    IcfesSimulatorSchool,
)
from app.db.models.identity import (
    Plan,
    PlatformRole,
    Profile,
    School,
    SchoolMembership,
    SchoolSettings,
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
from app.db.models.site import SiteContent
from app.db.models.support import SupportCase, SupportMessage

__all__ = [
    "AcademicPeriod",
    "AuditLog",
    "Base",
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
    "IcfesActivation",
    "IcfesAnswer",
    "IcfesAnswerKey",
    "IcfesAttempt",
    "IcfesQuestion",
    "IcfesScore",
    "IcfesSimulation",
    "IcfesSimulationQuestion",
    "IcfesSimulator",
    "IcfesSimulatorSchool",
    "LoginAttempt",
    "Material",
    "MaterialCourse",
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
    "SchoolSettings",
    "SiteContent",
    "SupportCase",
    "SupportMessage",
    "StudentEnrollment",
    "Subject",
    "Subscription",
    "SupportCase",
    "SupportMessage",
    "Task",
    "TaskSubmission",
    "TeacherAssignment",
    "User",
    "WompiEventProcessed",
]
