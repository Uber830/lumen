#!/usr/bin/env bash
# =============================================================================
# Sets up a local Postgres with the Lumen schema and the seed data.
# =============================================================================
#
# The backend talks to Postgres directly. In development that is a
# local container instead of a hosted project, which is faster and does
# not touch the real data.
#
# Usage:
#   ./scripts/dev-db.sh up      # create the database and apply the schema
#   ./scripts/dev-db.sh migrate # apply the pending migrations, keep the data
#   ./scripts/dev-db.sh reset   # drop it and start over
#   ./scripts/dev-db.sh down    # remove it
#
# The schema comes from two folders, applied in order:
#
#   db/migrations/      the schema inherited from the original project
#   backend/migrations/  the schema owned by this project
#
# The seed data comes from db/seed.sql and backend/seeds/.
#
# `migrate` is the one to use when the database already exists and a
# new migration landed: it applies only what is pending and keeps the
# rows that are there.
#
# The container is defined in docker-compose.yml; this script only
# manages its schema. The connection string it prints is the one to put
# in backend/.env.
# =============================================================================

set -euo pipefail

CONTAINER="${LUMEN_DB_CONTAINER:-lumen-dev-db}"
PORT="${LUMEN_DB_PORT:-55440}"
DB="${LUMEN_DB_NAME:-lumen_dev}"
PASSWORD="${LUMEN_DB_PASSWORD:-postgres}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

DATABASE_URL="postgresql://postgres:${PASSWORD}@127.0.0.1:${PORT}/${DB}"

# The log of the migrations that were applied. It lives in the database
# so the script knows what is pending without guessing.
MIGRATION_LOG="public.lumen_schema_migrations"

# The SQL states that mean "this object is already there". A migration
# that only fails with these was applied before: the base was created
# before the log existed, or the migration was run twice.
ALREADY_THERE="42P07 42710 42701 23505 25P02"

COMPOSE_FILE="$ROOT/docker-compose.yml"
USE_COMPOSE="false"
if [ -f "$COMPOSE_FILE" ] && docker compose version >/dev/null 2>&1; then
  USE_COMPOSE="true"
fi

wait_for_postgres() {
  # `pg_isready` is not enough: while the image initializes, Postgres
  # runs a temporary server that only listens on the socket. It answers
  # pg_isready before POSTGRES_DB exists and before the real server is
  # up. Wait until the server answers a real query instead.
  for _ in $(seq 1 60); do
    if docker exec "$CONTAINER" psql -U postgres -d postgres -tAc \
      'select 1' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "Postgres did not become ready" >&2
  return 1
}

start_container() {
  if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    # The container is already there, whether compose or a `docker run`
    # created it. Starting the one that exists avoids the name clash
    # that compose reports when it tries to create a second one.
    docker start "$CONTAINER" >/dev/null 2>&1 || true
  elif [ "$USE_COMPOSE" = "true" ]; then
    docker compose -f "$COMPOSE_FILE" up -d db >/dev/null
  else
    docker run -d --name "$CONTAINER" \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD="$PASSWORD" \
      -e POSTGRES_DB="$DB" \
      -p "${PORT}:5432" \
      postgres:16-alpine >/dev/null
  fi
  wait_for_postgres
}

stop_container() {
  if [ "$USE_COMPOSE" = "true" ]; then
    docker compose -f "$COMPOSE_FILE" down >/dev/null 2>&1 || true
  else
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}

create_database() {
  # DROP and CREATE go in separate psql calls on purpose: sent as one
  # multi-statement command they share a single transaction, and
  # DROP DATABASE cannot run inside a transaction block.
  #
  # FORCE ends the sessions still connected to the database, so the
  # schema can be rebuilt while the API is running.
  docker exec "$CONTAINER" psql -U postgres -d postgres -q \
    -c "DROP DATABASE IF EXISTS ${DB} WITH (FORCE)" >/dev/null
  docker exec "$CONTAINER" psql -U postgres -d postgres -q \
    -c "CREATE DATABASE ${DB}" >/dev/null

  # The inherited migrations expect a few platform objects. The shim
  # creates stand-ins so they can be applied to a plain Postgres.
  docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - \
    < "$ROOT/db/platform-shim.sql" >/dev/null

  apply_migrations

  for seed in "$ROOT/db/seed.sql" "$ROOT"/backend/seeds/*.sql; do
    [ -e "$seed" ] || continue
    echo "  applying $(basename "$seed")"
    docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - \
      < "$seed" >/dev/null
  done
}

# The log of the migrations that were applied. It is created by the
# script and not by a migration: it belongs to the tool, not to the
# schema the application uses.
ensure_log() {
  docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - >/dev/null 2>&1 <<SQL
create table if not exists ${MIGRATION_LOG} (
  name       text primary key,
  applied_at timestamptz not null default now()
);
SQL
}

record_migration() {
  docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - >/dev/null 2>&1 <<SQL
insert into ${MIGRATION_LOG} (name) values ('$1')
  on conflict (name) do nothing;
SQL
}

migration_applied() {
  local name="$1"
  local count
  count="$(docker exec "$CONTAINER" psql -U postgres -d "$DB" -t -A -c \
    "select count(*) from ${MIGRATION_LOG} where name = '$name'")"
  [ "$count" != "0" ]
}

# Apply one migration.
#
# Every statement runs on its own, the way the CI applies them. A
# migration whose only failures are "this object is already there" was
# applied before: it is recorded and the script moves on. A migration
# that fails for any other reason stops the script and prints the
# error, so a broken migration is never hidden.
apply_one() {
  local file="$1"
  local name output errors state unexpected=""
  name="$(basename "$file")"

  output="$(docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q \
    -v VERBOSITY=verbose -f - < "$file" 2>&1)" || true

  # Only the errors matter: a migration that says "this does not exist,
  # skipping" did its job. The `|| true` matters: the script stops at
  # the first command that fails, and a search that finds nothing is
  # not a failure.
  errors="$(printf '%s\n' "$output" | grep -E 'ERROR:  [0-9A-Z]{5}' || true)"

  if [ -z "$errors" ]; then
    record_migration "$name"
    echo "  applied $name"
    return 0
  fi

  # The SQL state of every failure says what happened.
  while read -r state; do
    [ -n "$state" ] || continue
    case " $ALREADY_THERE " in
      *" $state "*) ;;
      *) unexpected="$unexpected $state" ;;
    esac
  done <<<"$(printf '%s\n' "$errors" | awk '{print $2}' | sort -u || true)"

  if [ -z "$unexpected" ]; then
    record_migration "$name"
    echo "  already applied $name"
    return 0
  fi

  echo "  FAILED $name ($unexpected)" >&2
  printf '%s\n' "$errors" >&2
  return 1
}

# Apply the migrations that are pending, in order.
apply_migrations() {
  ensure_log
  for migration in "$ROOT"/db/migrations/*.sql "$ROOT"/backend/migrations/*.sql; do
    [ -e "$migration" ] || continue
    local name
    name="$(basename "$migration")"
    if migration_applied "$name"; then
      continue
    fi
    apply_one "$migration" "$name"
  done
}

migrate_database() {
  start_container
  # The database has to be there before the log: `migrate` updates an
  # existing one, it does not create it.
  docker exec "$CONTAINER" psql -U postgres -d postgres -q \
    -c "CREATE DATABASE ${DB}" >/dev/null 2>&1 || true

  # The inherited migrations expect a few platform objects. The shim
  # creates stand-ins so they can be applied to a plain Postgres. It
  # is written with `if not exists`, so running it on a database that
  # already has the schema changes nothing.
  docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - \
    < "$ROOT/db/platform-shim.sql" >/dev/null 2>&1

  apply_migrations
  echo
  echo "Up to date. DATABASE_URL=${DATABASE_URL}"
}

case "${1:-up}" in
  up)
    start_container
    create_database
    echo
    echo "Ready. Put this in backend/.env:"
    echo
    echo "  DATABASE_URL=${DATABASE_URL}"
    ;;
  migrate)
    migrate_database
    ;;
  reset)
    start_container
    create_database
    echo
    echo "Ready. DATABASE_URL=${DATABASE_URL}"
    ;;
  down)
    stop_container
    echo "Removed ${CONTAINER}."
    ;;
  *)
    echo "Usage: $0 [up|migrate|reset|down]" >&2
    exit 2
    ;;
esac
