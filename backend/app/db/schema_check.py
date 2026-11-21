"""The schema check.

The backend talks to a database whose schema is owned by the SQL
migrations: the inherited ones under `supabase/migrations/` and the
ones this project owns under `backend/migrations/`. If a migration was
not applied, the endpoints fail deep inside the request with an opaque
500: `relation "public.users" does not exist`.

This module turns that into a clear message, as early as possible.

The check runs two ways:

- `verify_schema()` is called from the application's startup. It
  looks for the tables the backend needs and reports the ones that
  are missing.
- `schema_status()` is exposed by `/ready`, so a deployment that
  skipped the migrations is visible in the health check instead of
  only in the logs.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# The tables the backend needs. Their absence means the migrations
# were not applied.
REQUIRED_TABLES = (
    "users",
    "profiles",
    "platform_roles",
    "schools",
    "school_memberships",
    "plans",
    "subscriptions",
    "entitlements",
    "refresh_tokens",
    "password_reset_tokens",
    "email_verification_tokens",
    "academic_periods",
    "courses",
    "subjects",
    "course_subjects",
    "teacher_assignments",
    "student_enrollments",
    "content_items",
    "content_progress",
    "tasks",
    "task_submissions",
    "grades",
    "evaluations",
    "evaluation_questions",
    "evaluation_answer_keys",
    "evaluation_attempts",
    "evaluation_answers",
    "icfes_questions",
    "icfes_answer_keys",
    "icfes_simulations",
    "icfes_simulation_questions",
    "icfes_attempts",
    "icfes_answers",
    "icfes_scores",
    "icfes_simulators",
    "icfes_simulator_schools",
    "icfes_activations",
    "chat_conversations",
    "chat_members",
    "chat_messages",
    "notifications",
    "support_cases",
    "support_messages",
    "wompi_events_processed",
    "site_content",
    "school_settings",
    "materials",
    "material_files",
    "material_schools",
    "material_courses",
    "material_history",
    "audit_log",
    "login_attempts",
)


@dataclass(frozen=True, slots=True)
class SchemaStatus:
    """Whether the database has the schema the backend needs."""

    ok: bool
    missing: tuple[str, ...] = ()
    unreachable: bool = False

    def message(self) -> str:
        """A message that says what to do about it."""
        if self.unreachable:
            return (
                "The database is unreachable. Check DATABASE_URL and that the "
                "Supabase project is running."
            )
        if self.ok:
            return "The schema is up to date."
        listed = ", ".join(self.missing)
        return (
            f"The database is missing {len(self.missing)} table(s): {listed}. "
            "The SQL migrations have not been applied. Apply them with psql "
            "(see scripts/dev-db.sh) or with the migration tool of your "
            "database."
        )


async def schema_status(session: AsyncSession) -> SchemaStatus:
    """Check that the tables the backend needs are there."""
    try:
        result = await session.execute(
            text("select table_name from information_schema.tables where table_schema = 'public'")
        )
    except Exception:
        return SchemaStatus(ok=False, unreachable=True)

    present = {row[0] for row in result.all()}
    missing = tuple(name for name in REQUIRED_TABLES if name not in present)
    return SchemaStatus(ok=not missing, missing=missing)


async def verify_schema(session: AsyncSession) -> None:
    """Raise when the schema is missing tables.

    Called from the application's startup. A missing migration is a
    deployment problem, and it should stop the process instead of
    failing every request.
    """
    status = await schema_status(session)
    if status.ok:
        return
    raise SchemaOutOfDateError(status.message())


class SchemaOutOfDateError(RuntimeError):
    """The database does not have the schema the backend expects."""
