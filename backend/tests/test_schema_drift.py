"""Schema drift guard.

The SQLAlchemy models in `app/db/models/` must stay in sync with the
Postgres schema that lives in Supabase. The schema is owned by the
SQL migrations under `supabase/migrations/`; the ORM is a mirror of
it.

This test parses the migrations and compares them column by column
against the ORM metadata. When someone adds a column to a migration
and forgets to update the model (or the other way around), the test
fails with a precise diff instead of letting the mismatch surface as
a runtime error in production.

`profiles.avatar_url` is added by a migration that uses
`alter table ... add column`, which the create-table parser does not
handle, so it is declared in `COLUMNS_ADDED_BY_ALTER` below.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.db.models import Base

# The migrations are applied in order: the inherited ones first, then
# the ones this project owns.
MIGRATION_DIRS = (
    Path(__file__).resolve().parents[2] / "supabase" / "migrations",
    Path(__file__).resolve().parents[1] / "migrations",
)

# Columns added by an `alter table` statement, which the create-table
# parser below does not see.
COLUMNS_ADDED_BY_ALTER = {
    "profiles": {"avatar_url"},
    "users": {"locked_until", "last_login_at"},
    "schools": {
        "city",
        "display_name",
        "logo_url",
        "primary_color",
    },
    "school_memberships": {"admin_role", "invited_by", "invited_at"},
    "academic_periods": {"closed_at", "delivery_modality"},
    "material_schools": {"archived_at"},
    "icfes_simulations": {"material_id", "average_score", "status"},
}

# Columns that a migration creates and another one drops.
#
# The catalog arrived in two shapes: the team of the platform declared
# `code` and `status`, and this project decided that `ref` and `state`
# are the names that stay. The migration that adapts the catalog drops
# the two columns of the other shape once their values are in `ref` and
# `state`, but the create-table parser still sees them in the file that
# brought them.
COLUMNS_DROPPED_BY_ADAPTATION = {
    "materials": {"code", "status"},
}

_CREATE_TABLE_RE = re.compile(
    r"create table (?:if not exists )?(?:public\.)?(\w+)\s*\((.*?)\n\);",
    re.IGNORECASE | re.DOTALL,
)


def _without_comments(sql: str) -> str:
    """The SQL without its comment lines.

    A commented-out statement is documentation, not schema: the
    rollback block of a migration describes the tables it would
    recreate, and those tables are not part of the schema.
    """
    return "\n".join(line for line in sql.split("\n") if not line.lstrip().startswith("--"))


def _parse_migration_columns() -> dict[str, set[str]]:
    """Extract {table: {column, ...}} from every create-table statement."""
    tables: dict[str, set[str]] = {}

    for directory in MIGRATION_DIRS:
        for path in sorted(directory.glob("*.sql")):
            sql = _without_comments(path.read_text(encoding="utf-8"))
            for match in _CREATE_TABLE_RE.finditer(sql):
                table_name, body = match.group(1), match.group(2)
                columns = tables.setdefault(table_name, set())
                for raw_line in body.split("\n"):
                    line = raw_line.strip()
                    if not line or line.startswith("--"):
                        continue
                    # Table-level constraints start with `constraint`.
                    if line.lower().startswith("constraint"):
                        continue
                    column_match = re.match(r"(\w+)\s+[a-z]", line, re.IGNORECASE)
                    if column_match:
                        columns.add(column_match.group(1))

    return tables


def _orm_columns() -> dict[str, set[str]]:
    """Extract {table: {column, ...}} from the SQLAlchemy metadata."""
    return {
        table.name: {column.name for column in table.columns}
        for table in Base.metadata.tables.values()
    }


@pytest.fixture(scope="module")
def migration_tables() -> dict[str, set[str]]:
    if not all(directory.is_dir() for directory in MIGRATION_DIRS):
        pytest.skip(f"migrations directories not found at {MIGRATION_DIRS}")
    return _parse_migration_columns()


@pytest.fixture(scope="module")
def orm_tables() -> dict[str, set[str]]:
    return _orm_columns()


def test_migrations_directory_is_not_empty(migration_tables: dict[str, set[str]]) -> None:
    """Guard against the parser silently finding nothing."""
    assert len(migration_tables) >= 34, (
        f"expected at least 34 tables in the migrations, found {len(migration_tables)}"
    )


def test_every_migrated_table_has_a_model(
    migration_tables: dict[str, set[str]],
    orm_tables: dict[str, set[str]],
) -> None:
    """Every table in the migrations must exist in the ORM."""
    missing = sorted(set(migration_tables) - set(orm_tables))
    assert not missing, f"tables present in the migrations but not modelled: {missing}"


def test_every_modelled_table_exists_in_the_migrations(
    migration_tables: dict[str, set[str]],
    orm_tables: dict[str, set[str]],
) -> None:
    """Every modelled table must exist in the migrations."""
    extra = sorted(set(orm_tables) - set(migration_tables))
    assert not extra, (
        f"tables modelled but absent from the migrations (add a migration "
        f"or remove the model): {extra}"
    )


def test_columns_match_the_migrations(
    migration_tables: dict[str, set[str]],
    orm_tables: dict[str, set[str]],
) -> None:
    """Every column must match between the migrations and the ORM."""
    problems: list[str] = []

    for table_name, migration_columns in sorted(migration_tables.items()):
        orm_columns = orm_tables.get(table_name)
        if orm_columns is None:
            continue

        expected = (
            migration_columns | COLUMNS_ADDED_BY_ALTER.get(table_name, set())
        ) - COLUMNS_DROPPED_BY_ADAPTATION.get(table_name, set())
        actual = orm_columns

        missing = sorted(expected - actual)
        extra = sorted(actual - expected)

        if missing:
            problems.append(f"{table_name}: columns in SQL but not in the model: {missing}")
        if extra:
            problems.append(f"{table_name}: columns in the model but not in SQL: {extra}")

    assert not problems, "\n".join(problems)


def test_school_scoped_tables_carry_school_id(
    migration_tables: dict[str, set[str]],
    orm_tables: dict[str, set[str]],
) -> None:
    """Tenant isolation depends on every academic row carrying school_id."""
    # Tables that are not tenant scoped: the catalog, the identity
    # tables and the cross-school ledgers.
    not_scoped = {
        "plans",
        "platform_roles",
        "profiles",
        "users",
        "password_reset_tokens",
        "email_verification_tokens",
        "refresh_tokens",
        "wompi_events_processed",
        # Personal, like the profile: what the user wants to be told
        # about, not what a school wants to tell them.
        "notification_preferences",
    }

    unscoped = sorted(
        table_name
        for table_name in migration_tables
        if table_name not in not_scoped
        and "school_id" not in migration_tables[table_name]
        and table_name not in orm_tables
    )
    assert not unscoped, f"tables missing a school_id column: {unscoped}"
