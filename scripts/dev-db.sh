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
#   ./scripts/dev-db.sh reset   # drop it and start over
#   ./scripts/dev-db.sh down    # remove it
#
# The schema comes from supabase/migrations/, the same migrations the
# real project uses. The seed data comes from supabase/seed.sql.
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
  if [ "$USE_COMPOSE" = "true" ]; then
    docker compose -f "$COMPOSE_FILE" up -d db >/dev/null
  elif docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER"; then
    docker start "$CONTAINER" >/dev/null 2>&1 || true
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
  docker exec "$CONTAINER" psql -U postgres -d postgres -q \
    -c "DROP DATABASE IF EXISTS ${DB}" >/dev/null
  docker exec "$CONTAINER" psql -U postgres -d postgres -q \
    -c "CREATE DATABASE ${DB}" >/dev/null

  # The migrations assume the Supabase platform objects. The shim
  # creates stand-ins so they can be applied to a plain Postgres.
  docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - \
    < "$ROOT/supabase/local-shim.sql" >/dev/null

  for migration in "$ROOT"/supabase/migrations/*.sql; do
    echo "  applying $(basename "$migration")"
    docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - \
      < "$migration" >/dev/null
  done

  if [ -f "$ROOT/supabase/seed.sql" ]; then
    echo "  applying seed.sql"
    docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -f - \
      < "$ROOT/supabase/seed.sql" >/dev/null
  fi
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
    echo "Usage: $0 [up|reset|down]" >&2
    exit 2
    ;;
esac
