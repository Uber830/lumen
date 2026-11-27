"""Migration tests.

The SQL migrations are the single owner of the schema: the ones inherited
from the original project live under `db/migrations/`, and the ones
owned by this project live under `backend/migrations/`. These tests apply
them to a fresh Postgres and check that the result is a schema the backend
can use:

- every table in `REQUIRED_TABLES` exists;
- the identity foreign keys point at `public.users`, which is what
  made `POST /v1/auth/login` answer 500 when the identity table
  still lived in an Alembic revision nobody applied.

The tests need the `lumen-test-db` container. They are skipped when
it is not running.
"""

from __future__ import annotations

import subprocess
from collections.abc import Generator
from pathlib import Path

import pytest

from app.db.schema_check import REQUIRED_TABLES

BACKEND_DIR = Path(__file__).resolve().parents[1]
# The migrations are applied in order: the inherited ones first, then
# the ones this project owns.
MIGRATION_DIRS = (
    BACKEND_DIR.parent / "db" / "migrations",
    BACKEND_DIR / "migrations",
)
SHIM = BACKEND_DIR.parent / "db" / "platform-shim.sql"

CONTAINER = "lumen-test-db"
DATABASE = "lumen_migration_test"


def _run_sql(sql: str, *, database: str) -> None:
    """Execute a SQL script inside the test container."""
    result = subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-d",
            database,
            "-q",
            "-f",
            "-",
        ],
        input=sql,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr


def _query(sql: str) -> list[str]:
    """Run a one-column query and return the values."""
    result = subprocess.run(
        [
            "docker",
            "exec",
            CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-d",
            DATABASE,
            "-t",
            "-A",
            "-c",
            sql,
        ],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr
    return [line for line in result.stdout.splitlines() if line]


@pytest.fixture(scope="module")
def migrated_database() -> Generator[None, None, None]:
    """A database with the SQL migrations applied.

    The inherited migrations expect a few platform objects (`auth`
    schema, the `authenticated` role).
    `db/platform-shim.sql` creates stand-ins so they can be applied to
    a plain Postgres.
    """
    try:
        subprocess.run(
            ["docker", "exec", CONTAINER, "pg_isready", "-U", "postgres"],
            capture_output=True,
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("the Postgres test container is not available")

    subprocess.run(
        [
            "docker",
            "exec",
            CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-c",
            f"DROP DATABASE IF EXISTS {DATABASE}",
            "-c",
            f"CREATE DATABASE {DATABASE}",
        ],
        capture_output=True,
        check=True,
    )

    _run_sql(SHIM.read_text(encoding="utf-8"), database=DATABASE)

    for directory in MIGRATION_DIRS:
        for migration in sorted(directory.glob("*.sql")):
            try:
                _run_sql(migration.read_text(encoding="utf-8"), database=DATABASE)
            except AssertionError as error:  # pragma: no cover - failure path
                raise AssertionError(f"{migration.name} failed:\n{error}") from error

    yield

    subprocess.run(
        [
            "docker",
            "exec",
            CONTAINER,
            "psql",
            "-U",
            "postgres",
            "-c",
            f"DROP DATABASE IF EXISTS {DATABASE}",
        ],
        capture_output=True,
        check=True,
    )


def test_the_migrations_create_every_required_table(migrated_database: None) -> None:
    """Every table the backend needs is created by the migrations."""
    present = set(
        _query("select table_name from information_schema.tables where table_schema = 'public'")
    )
    missing = [table for table in REQUIRED_TABLES if table not in present]
    assert not missing, f"tables the backend needs are not created: {missing}"


def test_the_identity_foreign_keys_point_at_public_users(migrated_database: None) -> None:
    """The identity FKs must reference `public.users`, not `auth.users`.

    Before the identity table moved into the migrations, this was the
    bug: the columns still pointed at `auth.users`, so a database
    without that table could not accept a registration.
    """
    rows = _query(
        "select conrelid::regclass::text || '.' || a.attname "
        "  from pg_constraint c "
        "  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1] "
        " where c.contype = 'f' "
        "   and c.confrelid = 'public.users'::regclass "
        " order by 1"
    )
    assert rows, "no foreign key points at public.users"

    # The tables that must reference the identity table. A missing one
    # means its column still points somewhere else.
    expected = {
        "content_items.posted_by",
        "grades.student_id",
        "profiles.id",
        "school_memberships.user_id",
        "task_submissions.student_id",
        "tasks.posted_by",
        "teacher_assignments.teacher_id",
        "student_enrollments.student_id",
    }
    missing = sorted(expected - set(rows))
    assert not missing, f"foreign keys not pointing at public.users: {missing}"


def test_the_migrations_do_not_reference_auth_users(migrated_database: None) -> None:
    """The backend owns identity; nothing may depend on `auth.users`."""
    rows = _query(
        "select conrelid::regclass::text || '.' || a.attname "
        "  from pg_constraint c "
        "  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1] "
        " where c.contype = 'f' "
        "   and c.confrelid = to_regclass('auth.users') "
        "   and c.connamespace = 'public'::regnamespace "
        " order by 1"
    )
    assert not rows, f"foreign keys still referencing auth.users: {rows}"


def test_every_table_in_the_public_schema_has_rls(migrated_database: None) -> None:
    """`public` is exposed by PostgREST; every table must opt out of it.

    A table in `public` without RLS is readable by anyone holding the
    project's publishable key. That is how `public.users` would leak
    the password hashes if it were created without RLS, which is why
    the identity and session tables carry it too.
    """
    rows = _query(
        "select relname from pg_class "
        " where relnamespace = 'public'::regnamespace "
        "   and relkind = 'r' "
        "   and not relrowsecurity "
        " order by 1"
    )
    assert not rows, f"tables in public without row level security: {rows}"
