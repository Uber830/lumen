"""Schema check tests.

The backend reads columns that the SQL migrations add with
`alter table ... add column`. A database where the table exists but
the column does not used to start happily and fail later with an
opaque 500 (`column "schools.display_name" does not exist`). The check now
compares the columns of the models with the columns of the database,
so the drift is reported before the first request.

The comparison is a pure function, so these tests do not touch the
database: they hand it the columns it would read and check what it
says.
"""

from __future__ import annotations

from app.db.schema_check import (
    REQUIRED_COLUMNS,
    REQUIRED_TABLES,
    SchemaStatus,
    status_of,
)


def _complete_database() -> dict[str, set[str]]:
    """A database with every table and column the backend needs."""
    return {table: set(columns) for table, columns in REQUIRED_COLUMNS.items()}


def test_a_complete_database_is_ok() -> None:
    """Nothing is missing when the migrations were applied."""
    status = status_of(_complete_database())
    assert status.ok
    assert status.message() == "The schema is up to date."


def test_a_missing_column_is_reported() -> None:
    """A column that is not there is named in the report."""
    present = _complete_database()
    present["schools"].discard("display_name")

    status = status_of(present)

    assert not status.ok
    assert status.missing_columns == ("schools.display_name",)
    assert "schools.display_name" in status.message()


def test_a_missing_table_is_reported() -> None:
    """A table that is not there is named in the report."""
    present = _complete_database()
    del present["support_cases"]

    status = status_of(present)

    assert not status.ok
    assert status.missing == ("support_cases",)
    assert "support_cases" in status.message()


def test_the_columns_come_from_the_models() -> None:
    """The check reads the models, so it cannot drift apart from them."""
    assert "schools" in REQUIRED_COLUMNS
    assert "display_name" in REQUIRED_COLUMNS["schools"]
    assert "city" in REQUIRED_COLUMNS["schools"]
    assert "support_cases" in REQUIRED_COLUMNS
    assert REQUIRED_TABLES


def test_the_message_says_what_to_do() -> None:
    """A report without an action is not a report."""
    status = SchemaStatus(ok=False, missing=("users",), missing_columns=("schools.city",))
    message = status.message()
    assert "users" in message
    assert "schools.city" in message
    assert "scripts/dev-db.sh" in message
