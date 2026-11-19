"""Alembic environment for Lumen.

The database schema is owned by the SQL migrations under
`supabase/migrations/`; they are applied to the Supabase project with
the Supabase CLI. Alembic is configured here so that the Python side
can:

- autogenerate a diff between the SQLAlchemy models and a live
  database (useful to catch drift, and to produce the SQL for a new
  migration);
- apply migrations in environments where the Supabase CLI is not
  available (CI, local containers).

`target_metadata` is the shared `Base`, so autogenerate compares the
models against the database.

The URL comes from `DATABASE_URL` (or `TEST_DATABASE_URL` in tests),
never from alembic.ini, so credentials stay out of the repository.
"""

from __future__ import annotations

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from sqlalchemy.engine import Connection

from alembic import context
from app.config import get_settings
from app.db.models import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def _database_url() -> str:
    """Resolve the database URL for the migration run.

    Alembic runs migrations on a *synchronous* connection, so an
    async driver in the URL has to be swapped for its sync
    counterpart (psycopg). The application uses asyncpg; the
    migration tooling uses psycopg.
    """
    url = os.environ.get("ALEMBIC_DATABASE_URL") or os.environ.get("DATABASE_URL")
    if not url:
        url = get_settings().effective_database_url

    # asyncpg -> psycopg
    url = url.replace("postgresql+asyncpg://", "postgresql+psycopg://")
    # The bare postgresql:// URL already selects the sync driver.
    return url


def run_migrations_offline() -> None:
    """Emit the SQL to stdout instead of running it."""
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run the migrations against an open connection."""
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run the migrations against a live database."""
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _database_url()

    connectable = engine_from_config(
        section,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
