#!/usr/bin/env bash
# =============================================================================
# Sets the demo accounts of the development database.
# -----------------------------------------------------------------------------
# The development database comes with the accounts of the seed: the
# platform team, the administrator of the demo school, a teacher and a
# student. This script makes sure they are usable: it resets their
# password to `lumen-dev` and it makes sure the role and the membership
# are there.
#
# It is the script to run when the password of one of them was changed,
# when a membership was removed by hand, or when a new view needs an
# account of a role that did not exist yet.
#
# Usage:
#   ./scripts/dev-accounts.sh        # fix the accounts of the dev database
#
# The database is the one of `scripts/dev-db.sh`: the container
# `lumen-dev-db`, the port 55440 and the database `lumen_dev`. They can
# be changed with the same environment variables.
# =============================================================================

set -euo pipefail

CONTAINER="${LUMEN_DB_CONTAINER:-lumen-dev-db}"
PORT="${LUMEN_DB_PORT:-55440}"
DB="${LUMEN_DB_NAME:-lumen_dev}"
PASSWORD="${LUMEN_DB_PASSWORD:-postgres}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "El contenedor de la base de desarrollo no está en marcha." >&2
  echo "Levántalo con ./scripts/dev-db.sh up" >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -U postgres -d "$DB" -q -v ON_ERROR_STOP=1 -f - \
  < "$HERE/dev-accounts.sql" >/dev/null

echo "Cuentas de demostración listas (contraseña: lumen-dev):"
docker exec "$CONTAINER" psql -U postgres -d "$DB" -q -c "
  select
    u.email,
    coalesce(pr.role::text, m.role::text, '—') as rol,
    coalesce(s.short_code, '—') as colegio
  from public.users u
  left join public.platform_roles pr on pr.user_id = u.id
  left join public.school_memberships m on m.user_id = u.id
  left join public.schools s on s.id = m.school_id
  where u.email in (
    'super@lumen.co',
    'ana.restrepo@sagcor.edu.co',
    'docente01@sagcor.edu.co',
    'estudiante001@sagcor.edu.co'
  )
  order by u.email;
"
