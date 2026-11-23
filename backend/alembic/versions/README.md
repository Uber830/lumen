# The Alembic versions directory

**The SQL migrations are the single owner of the schema.** They live in
`db/migrations/` (inherited from the original project) and in
`backend/migrations/` (owned by this project), and they are applied in
that order with `psql`.

This directory is a scratch space for Alembic's *autogenerate*, which
diffs the SQLAlchemy models against a live database and writes the
missing DDL:

```sh
# Point at a database that has the migrations applied.
export DATABASE_URL="postgresql+psycopg://..."

# Write the diff.
uv run alembic revision --autogenerate -m "describe the change"

# Read alembic/versions/<generated>.py, translate it into a SQL file
# under backend/migrations/, and delete the generated revision.
```

The generated revision is never applied. The SQL migration is.

Two reasons for the split:

- The migrations are plain SQL, so they apply to any Postgres. Keeping
  one format means one order and no ambiguity about what ran when.
- The database is reached through the ORM, but the schema stays in
  SQL: that is what the models are checked against.

Alembic still earns its place: `alembic revision --autogenerate` is
how the models are checked against a live database, and it is what
caught the composite unique constraints that were missing from the
models in Phase 3.
