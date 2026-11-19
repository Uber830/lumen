# The Alembic versions directory

**The SQL migrations under `supabase/migrations/` are the single owner
of the schema.** They are applied with `supabase db push`, and they
are what a Supabase project expects.

This directory is a scratch space for Alembic's *autogenerate*, which
diffs the SQLAlchemy models against a live database and writes the
missing DDL:

```sh
# Point at a database that has the migrations applied.
export DATABASE_URL="postgresql+psycopg://..."

# Write the diff.
uv run alembic revision --autogenerate -m "describe the change"

# Read alembic/versions/<generated>.py, translate it into a SQL file
# under supabase/migrations/, and delete the generated revision.
```

The generated revision is never applied. The SQL migration is.

Two reasons for the split:

- `supabase db push` is how a Supabase project is updated. Keeping one
  tool means one order and no ambiguity about what ran when.
- The platform's own tooling (the SQL editor, the schema diff in the
  dashboard) assumes the schema lives in `supabase/migrations/`.

Alembic still earns its place: `alembic revision --autogenerate` is
how the models are checked against a live database, and it is what
caught the composite unique constraints that were missing from the
models in Phase 3.
