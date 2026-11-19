# Lumen backend (FastAPI)

La API de Lumen. Es la dueña de la autenticación, la autorización y de cada
regla de negocio: el navegador solo habla con este servicio.

Postgres es el almacén de datos y el backend se conecta a él directamente con
asyncpg. Supabase Storage y Realtime siguen en uso para los archivos y el
chat en vivo.

- [Arranque rápido](#arranque-rápido)
- [Layout](#layout)
- [Endpoints](#endpoints)
- [Autenticación](#autenticación)
- [Esquema y migraciones](#esquema-y-migraciones)
- [Pruebas](#pruebas)
- [Convenciones](#convenciones)

---

## Arranque rápido

```sh
# 1. La base de datos, desde la raíz del repositorio
./scripts/dev-db.sh up
#    imprime: postgresql://postgres:postgres@127.0.0.1:55440/lumen_dev

# 2. La configuración
cp .env.example .env
#    pega la DATABASE_URL que imprimió el paso anterior y rellena
#    JWT_SECRET:  python -c "import secrets; print(secrets.token_urlsafe(48))"

# 3. Las dependencias y el servidor
uv sync --extra dev
uv run lumen-api            # http://localhost:8010
```

`lumen-api` es el script de `pyproject.toml`; arranca en el puerto **8010**
(8000 lo usa la pila de EduSuite en esta máquina) y acepta `--reload`:

```sh
uv run uvicorn app.main:app --reload --port 8010
```

Comprobación de que está vivo:

```sh
curl http://localhost:8010/ready
```

`/ready` devuelve 503 si a la base le falta el esquema: es la forma rápida de
ver que las migraciones no se aplicaron.

### Variables de entorno

| Variable | Para qué |
| --- | --- |
| `DATABASE_URL` | la cadena de conexión de Postgres (obligatoria) |
| `JWT_SECRET` | firma los tokens de acceso (obligatoria) |
| `CORS_ALLOWED_ORIGINS` | orígenes permitidos, separados por comas |
| `COOKIE_DOMAIN` | solo si el frontend y la API viven en subdominios distintos |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_PUBLISHABLE_KEY` | Storage y Realtime |
| `LOGIN_RATE_LIMIT_ATTEMPTS`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | la puerta del login (5 por minuto) |
| `LOGIN_LOCK_THRESHOLD`, `LOGIN_LOCK_MINUTES` | el bloqueo de la cuenta (10 fallos, 15 min) |

El resto está en `.env.example`, comentado.

---

## Layout

```
app/
  main.py            FastAPI app, middleware, manejadores de errores
  config.py          Pydantic settings (env)
  deps.py            dependencias de FastAPI (sesión, contexto, roles)
  academics/         períodos, cursos, materias, asignaciones, matrículas
  auth/
    dependencies.py  verificación del JWT y dependencia del usuario actual
    operations.py    cuentas, autenticación, sesiones, contraseñas
    router.py        los endpoints de acceso
    schemas.py       modelos de petición y respuesta
    attempts.py      la traza de intentos: rate limit y bloqueo
  chat/              conversaciones, miembros, mensajes
  content/           el material que un docente publica en un curso
  core/
    access.py        los permisos por curso-materia
    context.py       el RequestContext: quién llama y qué puede hacer
    pagination.py    el sobre de las listas
    permissions.py   los permisos (puerto de los helpers SQL)
    security.py      hash de contraseñas Argon2id
    tokens.py        emisión de tokens de acceso y de refresco
    errors.py        excepciones del dominio y su mapeo HTTP
  db/
    base.py          DeclarativeBase y helpers de columnas
    enums.py         enums que reflejan los tipos enum de Postgres
    models/          un módulo por dominio
    session.py       engine async, session factory, dependencia get_db
    schema_check.py  la verificación del esquema al arrancar
  evaluations/       las evaluaciones escritas y sus intentos
  grades/            las notas que registra un docente
  health.py          las sondas /health y /ready
  icfes/             el ciclo de intento del banco y la autoría
  notifications/     las notificaciones dentro de la app
  platform/          lo que hace el equipo de plataforma (dar de alta colegios)
  plans/             el catálogo de planes
  schools/           el perfil de cada colegio
  site/              el contenido editable del sitio público
  subscriptions/     el checkout y el webhook de Wompi
  tasks/             las tareas y sus entregas
  users/             invitaciones y operaciones de identidad
  wompi/             cliente HTTP de Wompi
migrations/          migraciones SQL de este proyecto
seeds/               datos semilla de este proyecto
alembic/             andamiaje para el diff de esquema (el esquema vive en SQL)
tests/               la suite de pytest
Dockerfile           imagen de producción multi-etapa
```

---

## Endpoints

### Salud

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | sonda de vida |
| GET | `/ready` | sonda de disponibilidad (base de datos + esquema) |

### Acceso

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/auth/login` | cambiar una contraseña por una sesión |
| POST | `/v1/auth/refresh` | cambiar un refresh token por un par nuevo |
| POST | `/v1/auth/logout` | revocar un refresh token |
| GET | `/v1/auth/me` | el contexto de sesión del llamador |
| PATCH | `/v1/auth/me` | actualizar el perfil |
| POST | `/v1/auth/me/avatar` | cambiar el avatar |
| POST | `/v1/auth/forgot-password` | iniciar el flujo de restablecimiento |
| POST | `/v1/auth/reset-password` | poner una contraseña nueva con un token |
| GET | `/v1/auth/supabase-token` | el token corto para Storage y Realtime |

**No hay registro público.** Quien quiera usar Lumen habla con el equipo de
plataforma; el alta la hace `POST /v1/platform/schools` (solo `platform_admin`),
que devuelve el enlace de activación del administrador.

### Sitio público

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/public/site` | el copy, las cifras y el catálogo de la landing |

### Plataforma

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/platform/schools` | crear un colegio con su administrador (solo plataforma) |

### Académico

| Method | Path | Purpose |
| --- | --- | --- |
| GET/POST | `/v1/academics/periods` | los períodos académicos del colegio |
| PATCH/DELETE | `/v1/academics/periods/{id}` | actualizar o borrar un período |
| GET/POST | `/v1/academics/courses` | los cursos del colegio, con sus conteos |
| PATCH/DELETE | `/v1/academics/courses/{id}` | actualizar o borrar un curso |
| GET/POST | `/v1/academics/subjects` | las materias del colegio |
| PATCH/DELETE | `/v1/academics/subjects/{id}` | actualizar o borrar una materia |
| GET/POST | `/v1/academics/course-subjects` | las materias que se ofrecen en un curso |
| PATCH/DELETE | `/v1/academics/course-subjects/{id}` | actualizar o quitar una materia de un curso |
| GET/POST | `/v1/academics/teacher-assignments` | las asignaciones de docentes |
| PATCH/DELETE | `/v1/academics/teacher-assignments/{id}` | actualizar o quitar una asignación |
| GET/POST | `/v1/academics/student-enrollments` | las matrículas de estudiantes |
| PATCH/DELETE | `/v1/academics/student-enrollments/{id}` | actualizar o quitar una matrícula |
| GET | `/v1/academics/members` | los miembros del colegio, con su perfil |

### Usuarios, colegios y planes

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/v1/users/invitations` | crear un usuario + perfil + membresía |
| POST | `/v1/users/bulk-upload` | hasta 500 invitaciones en una llamada |
| GET | `/v1/users/memberships` | las membresías activas del llamador |
| PATCH | `/v1/users/memberships/{id}` | cambiar el rol o revocar una membresía |
| POST | `/v1/users/memberships/{id}/activation-link` | un enlace nuevo para un miembro sin activar |
| GET | `/v1/schools/me` | el colegio del llamador, con su marca |
| PATCH | `/v1/schools/me` | actualizar la marca del colegio |
| POST | `/v1/schools/me/logo` | subir el escudo del colegio |
| GET | `/v1/plans` | el catálogo de planes |

### Suscripciones, contenido y evaluación

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/subscriptions` | la suscripción y los entitlements del colegio |
| POST | `/v1/subscriptions/checkout` | abrir el checkout de Wompi |
| POST | `/v1/subscriptions/portal` | la URL del portal de cliente de Wompi |
| POST | `/v1/webhooks/wompi` | el webhook de Wompi (firma verificada, idempotente) |
| POST | `/v1/icfes/simulations/{id}/attempts` | empezar un intento (sin respuestas) |
| POST | `/v1/icfes/attempts/{id}/finalize` | entregar, calificar y guardar |
| GET | `/v1/icfes/comparisons` | los agregados por simulación (docente) |
| GET/POST/PATCH/DELETE | `/v1/content/items` | el material de un curso-materia |
| GET/POST/PATCH/DELETE | `/v1/tasks` | las tareas y sus entregas |
| GET/POST/PATCH/DELETE | `/v1/grades` | las notas |
| GET/POST/PATCH/DELETE | `/v1/evaluations` | las evaluaciones y sus intentos |
| GET/POST/PATCH/DELETE | `/v1/chat/conversations` | el chat |

### Notificaciones

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/v1/notifications` | las notificaciones del llamador, más recientes primero |
| GET | `/v1/notifications/unread-count` | cuántas hay sin leer |
| POST | `/v1/notifications/{id}/read` | marcar una como leída |
| POST | `/v1/notifications/read-all` | marcar todas como leídas |
| DELETE | `/v1/notifications/{id}` | descartar una |
| GET/PATCH | `/v1/notifications/preferences` | qué se le quiere contar |

---

## Autenticación

El backend es el dueño de la autenticación.

- **Contraseñas**: Argon2id. Los hashes bcrypt de las cuentas migradas se
  siguen aceptando y el primer login los reescribe a Argon2id, así que el
  formato antiguo se drena solo.
- **Tokens de acceso**: JWT HS256 firmados con `JWT_SECRET`. Duran 15 minutos
  y solo llevan el id del usuario y su correo.
- **Tokens de refresco**: cadenas opacas. Solo se guarda su hash SHA-256, así
  que una fuga de la base no entrega sesiones válidas.

**La sesión del navegador vive en cookies httpOnly.** El JavaScript de la
página no puede leerlas, así que un XSS no puede robarse la sesión. El
navegador las manda con `credentials: "include"`; las server functions del
frontend las leen de la petición y las reenvían como `Authorization: Bearer`.
La API acepta las dos formas.

Dos propiedades que los tests imponen:

- **Un refresh token es de un solo uso.** Al rotarlo se revoca el anterior.
  Presentar uno ya usado revoca *todas* las sesiones de ese usuario.
- **Un restablecimiento de contraseña revoca todas las sesiones.**

Ni el login ni el «olvidé mi contraseña» revelan si una cuenta existe: las
respuestas son idénticas en los dos casos.

### La puerta del login

`POST /v1/auth/login` responde siempre `El correo o la contraseña no
coinciden.` cuando las credenciales no cuadran. Además:

- **5 intentos por minuto** y por par (correo, dirección) → `429` con
  `Retry-After`;
- **10 fallos** bloquean la cuenta 15 minutos → `423`;
- cada intento queda en `login_attempts`, con el correo hasheado (HMAC), nunca
  en claro.

El bloqueo se responde **después** de validar la contraseña, para no confirmar
que la cuenta existe.

### El alta de los colegios

Nadie se registra solo. El equipo de plataforma da de alta el colegio:

```sh
curl -X POST http://localhost:8010/v1/platform/schools \
  -H "Authorization: Bearer $TOKEN_DE_PLATAFORMA" \
  -H "Content-Type: application/json" \
  -d '{"school_name":"Colegio Sagrado Corazón","short_code":"SAGCOR",
       "plan_code":"estandar","admin_email":"ana@colegio.edu.co",
       "admin_name":"Ana Restrepo"}'
```

La respuesta trae el **enlace de activación** del administrador: su cuenta
nace sin contraseña y la define con ese enlace (`POST /v1/auth/reset-password`
con el token). Nadie tiene que llevar una contraseña escrita de un sitio a
otro.

---

## Esquema y migraciones

**Las migraciones SQL son la única dueña del esquema**: las heredadas en
`supabase/migrations/` y las de este proyecto en `backend/migrations/`, que se
aplican en ese orden. Eso incluye la tabla de identidad que usa el backend
(`public.users`, que sustituye a `auth.users`) y sus tablas de sesión.

El backend comprueba el esquema al arrancar y se niega a levantar si falta
una migración:

```
The database is missing 3 table(s): refresh_tokens, ...
The SQL migrations have not been applied. Apply them with psql (see
scripts/dev-db.sh) or with the migration tool of your database.
```

`GET /ready` informa de lo mismo, así que un despliegue que se saltó las
migraciones aparece como no disponible en vez de responder 500 a todo.

Para escribir una migración nueva:

1. se escribe el SQL en `backend/migrations/<fecha>_<qué>.sql`;
2. se corre `./scripts/dev-db.sh reset` desde la raíz;
3. `backend/tests/test_schema_drift.py` compara los modelos con las
   migraciones y `backend/tests/test_migrations.py` las aplica en una base
   limpia: un desajuste rompe el build en vez de aparecer en runtime.

Alembic no es una segunda fuente de migraciones. `backend/alembic/` es
andamiaje para `alembic revision --autogenerate`, que contrasta los modelos
SQLAlchemy con una base viva; la revisión generada se traduce a SQL y se
borra. Ver `alembic/versions/README.md`.

`supabase/local-shim.sql` crea los objetos de plataforma de Supabase (el
schema `auth`, el `storage`, el rol `authenticated`) para que las migraciones
heredadas también se puedan aplicar en un Postgres normal.

---

## Pruebas

La suite necesita un Postgres. Usa `TEST_DATABASE_URL`, o `DATABASE_URL` si no
está definida. La base de pruebas es **otra** que la de desarrollo, en el
puerto **55441** (55440 es la de desarrollo, 55432 la de EduSuite):

```sh
docker run -d --name lumen-test-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lumen_test \
  -p 55441:5432 postgres:16-alpine

cd backend
TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55441/lumen_test" \
  uv run pytest
```

Sin base de datos, las pruebas de lógica pura corren igual y el resto se
saltan.

```sh
uv run pytest                          # la suite
uv run ruff check app tests            # lint
uv run ruff format --check app tests   # formato
uv run mypy                            # tipos
```

Los correos de las pruebas usan el dominio `@example.com`: el fixture
`cleanup_users` borra esas filas entre pruebas.

---

## Permisos

Con la CRUD dentro del backend, la RLS ya no está en el camino, así que sus
comprobaciones viven en Python. `app/core/permissions.py` es el puerto de los
siete helpers `SECURITY DEFINER` que declaraban las migraciones, y
`app/core/context.py` lleva el `RequestContext`: la identidad del llamador,
sus membresías activas y su rol de plataforma, cargados una vez por petición.

Dos reglas que sigue el código:

- **El `school_id` del cuerpo de la petición solo sirve para buscar una
  membresía.** Nunca da acceso por sí mismo.
- **Un llamador que no pertenece a un colegio recibe un 404, no un 403.** Un
  403 confirmaría que el colegio existe, y el endpoint serviría para
  sondear los ids de otros tenants. Si sí pertenece pero con otro rol, ahí
  sí es un 403: ya sabe que existe.

`tests/test_tenant_isolation.py` cubre los escenarios entre tenants.

---

## Convenciones

- Estilo funcional puro: los routers se quedan finos y la lógica vive en
  `operations.py`. Que el cálculo de notas sea determinista, para que las
  pruebas puedan usar fixtures.
- **Aislamiento por tenant**: `school_id` nunca se toma del cuerpo de la
  petición, sale de las membresías del llamador y del recurso que se
  direcciona.
- El webhook de Wompi **tiene que** verificar la firma antes de tocar la
  base. La idempotencia se fuerza con un insert en
  `wompi_events_processed` con `ON CONFLICT DO NOTHING`.
- Los secretos vienen de `pydantic-settings` (`SecretStr` para los tokens).
  Nunca se registran ni se trazan.
- Las pruebas son pytest. Las que tocan la base corren contra un Postgres
  real; las de lógica pura no necesitan uno.
- El comentario de código va en español y solo cuando explica un *por qué*,
  nunca un *qué*.
