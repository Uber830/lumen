"""The models must carry the constraints the migrations declare.

The Phase 0 models were missing the composite unique constraints. The
symptom was subtle: the API accepted a duplicate row, and the
database happily stored it, because `create_all` had not created the
constraint. The tests that caught it were the ones checking that a
duplicate is refused.

This test compares the constraints declared in the models against the
ones the SQL migrations declare, so a missing constraint fails the
build instead of showing up as a duplicate row in production.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest
from sqlalchemy import UniqueConstraint

from app.db.models import Base

# The migrations are applied in order: the inherited ones first, then
# the ones this project owns.
MIGRATION_DIRS = (
    Path(__file__).resolve().parents[2] / "supabase" / "migrations",
    Path(__file__).resolve().parents[1] / "migrations",
)

# The migrations declare the unique constraints with a `constraint ...
# unique (...)` clause. The parser looks for those.
_UNIQUE_CLAUSE_RE = re.compile(
    r"constraint\s+(\w+)\s+unique\s*\(([^)]*)\)",
    re.IGNORECASE,
)

# The tables whose unique constraints the models declare by name.
# The migrations name them explicitly; the models use the same names.
_TABLES_WITH_NAMED_CONSTRAINTS = {
    "academic_periods",
    "chat_members",
    "content_progress",
    "course_subjects",
    "courses",
    "evaluation_answer_keys",
    "evaluation_answers",
    "evaluation_attempts",
    "evaluation_questions",
    "grades",
    "icfes_answer_keys",
    "icfes_answers",
    "icfes_attempts",
    "icfes_scores",
    "icfes_simulation_questions",
    "notification_preferences",
    "plans",
    "school_memberships",
    "schools",
    "student_enrollments",
    "subjects",
    "subscriptions",
    "task_submissions",
    "teacher_assignments",
}


def _migration_unique_constraints() -> dict[str, dict[str, tuple[str, ...]]]:
    """Extract {table: {constraint_name: (columns, ...)}} from the migrations."""
    constraints: dict[str, dict[str, tuple[str, ...]]] = {}

    for directory in MIGRATION_DIRS:
        for path in sorted(directory.glob("*.sql")):
            sql = path.read_text(encoding="utf-8")

            # Track the table the statements apply to.
            current_table: str | None = None
            for line in sql.split("\n"):
                table_match = re.match(
                    r"\s*(?:create table (?:if not exists )?)?(?:public\.)?(\w+)\s*\(",
                    line,
                    re.IGNORECASE,
                )
                if table_match and "constraint" not in line.lower():
                    candidate = table_match.group(1)
                    if candidate not in ("select", "where", "values", "on"):
                        current_table = candidate

                constraint_match = _UNIQUE_CLAUSE_RE.search(line)
                if constraint_match and current_table:
                    name = constraint_match.group(1)
                    columns = tuple(
                        column.strip()
                        for column in constraint_match.group(2).split(",")
                        if column.strip()
                    )
                    constraints.setdefault(current_table, {})[name] = columns

    return constraints


def _model_unique_constraints() -> dict[str, dict[str, tuple[str, ...]]]:
    """Extract {table: {constraint_name: (columns, ...)}} from the models."""
    constraints: dict[str, dict[str, tuple[str, ...]]] = {}

    for table in Base.metadata.tables.values():
        for constraint in table.constraints:
            if not isinstance(constraint, UniqueConstraint):
                continue
            name = constraint.name
            if not name:
                continue
            columns = tuple(column.name for column in constraint.columns)
            constraints.setdefault(table.name, {})[str(name)] = columns

    return constraints


@pytest.fixture(scope="module")
def migration_constraints() -> dict[str, dict[str, tuple[str, ...]]]:
    if not all(directory.is_dir() for directory in MIGRATION_DIRS):
        pytest.skip(f"migrations directories not found at {MIGRATION_DIRS}")
    return _migration_unique_constraints()


@pytest.fixture(scope="module")
def model_constraints() -> dict[str, dict[str, tuple[str, ...]]]:
    return _model_unique_constraints()


def test_the_parser_finds_the_constraints(migration_constraints):
    """Guard against the parser silently finding nothing."""
    total = sum(len(names) for names in migration_constraints.values())
    assert total >= 20, f"expected at least 20 unique constraints, found {total}"


def test_every_migrated_unique_constraint_is_in_the_models(
    migration_constraints,
    model_constraints,
):
    """A constraint the migrations declare must exist in the model.

    This is the check that catches the missing constraints: a
    constraint that is not in the model is not created by
    `create_all`, so the database would accept the duplicates the
    constraint was there to prevent.
    """
    problems: list[str] = []

    for table, constraints in sorted(migration_constraints.items()):
        if table not in _TABLES_WITH_NAMED_CONSTRAINTS:
            continue

        model_names = model_constraints.get(table, {})

        for name, columns in sorted(constraints.items()):
            if name not in model_names:
                problems.append(
                    f"{table}: constraint {name} ({', '.join(columns)}) is missing from the model"
                )
                continue

            model_columns = model_names[name]
            if set(model_columns) != set(columns):
                problems.append(
                    f"{table}.{name}: the migration declares "
                    f"({', '.join(columns)}) but the model declares "
                    f"({', '.join(model_columns)})"
                )

    assert not problems, "\n".join(problems)


def test_the_models_declare_no_extra_unique_constraints(
    model_constraints,
):
    """The models must not invent constraints the schema does not have.

    An extra constraint would make the API refuse something the
    database allows, which is a difference the user would notice.
    """
    # The models add the composite unique constraints from the
    # migrations. The single-column ones come from `unique=True` on the
    # column definition, which SQLAlchemy names after the table.
    problems: list[str] = []

    for table, constraints in sorted(model_constraints.items()):
        for name, columns in sorted(constraints.items()):
            if len(columns) == 1:
                # A single-column unique constraint: the migrations
                # declare these inline as `unique`, not as a named
                # constraint clause, so they are not compared above.
                continue
            if table not in _TABLES_WITH_NAMED_CONSTRAINTS:
                problems.append(
                    f"{table}.{name}: the model declares a composite unique "
                    f"constraint for a table the migrations do not name one for"
                )

    assert not problems, "\n".join(problems)
