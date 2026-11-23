# `db/` — el esquema de la base de datos

Aquí vive el esquema de Lumen: SQL plano, aplicado a un Postgres común con
`psql`. No hay CLI de plataforma de por medio; el backend aplica las
migraciones en orden y el orden importa.

## Qué hay en esta carpeta

| Ruta | Qué es |
| --- | --- |
| `db/migrations/` | Las migraciones heredadas del proyecto original. Son SQL plano y se aplican en orden alfabético (el prefijo de fecha las ordena). |
| `db/platform-shim.sql` | El shim local de Postgres: los objetos que las migraciones heredadas esperan y que un Postgres común no tiene. |
| `db/seed.sql` | Datos de desarrollo (catálogo de planes y datos base). |
| `db/sql-tests/` | Pruebas pgTAP de aislamiento por colegio. No se ejecutan en CI. |

## El orden de aplicación

El esquema se construye con dos carpetas, y siempre en este orden:

1. `db/migrations/` — lo heredado del proyecto original.
2. `backend/migrations/` — lo que es propio de este proyecto.

El shim va **antes** que las dos: se aplica sobre la base recién creada y
prepara los objetos que las migraciones heredadas necesitan.

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f db/platform-shim.sql
for directory in db/migrations backend/migrations; do
  for migration in $(ls "$directory"/*.sql | sort); do
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$migration"
  done
done
```

Ese es exactamente el orden que usa `./scripts/dev-db.sh` y el que usa el
pipeline de CI.

## `db/platform-shim.sql`

Las migraciones heredadas se escribieron asumiendo que el motor de base de
datos traía consigo tres cosas que un Postgres común no tiene:

- el schema `auth`, con la tabla `auth.users` (la tabla de identidad);
- las funciones `auth.uid()` y `auth.role()`, que las policies de RLS
  usan para saber quién pregunta;
- los roles `anon`, `authenticated` y `service_role`, a los que las
  policies de RLS apuntan (`to authenticated`, etc.).

El shim crea esos objetos para que las migraciones se puedan aplicar
contra un Postgres normal. Es local: describe el entorno, no el esquema
que usa la aplicación. Se escribe con `if not exists`, así que aplicarlo
sobre una base que ya tiene todo no cambia nada.

## `db/seed.sql`

Datos de desarrollo: el catálogo de planes y los datos base que el
frontend y el backend necesitan para trabajar en local. Se aplica después
de las migraciones, junto con `backend/seeds/`.

## Cómo se aplica todo

El script `scripts/dev-db.sh` levanta el Postgres en Docker y aplica el
esquema:

```sh
./scripts/dev-db.sh up      # crea la base y aplica el esquema y la semilla
./scripts/dev-db.sh migrate # aplica solo las migraciones pendientes, sin perder los datos
./scripts/dev-db.sh reset   # la deja desde cero
./scripts/dev-db.sh down    # la borra
```

`migrate` es la que se usa cuando llega una migración nueva y la base ya
existe: aplica lo que falta y conserva las filas que hay.
