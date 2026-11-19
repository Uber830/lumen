# Lumen backend (FastAPI)

The API for Lumen. It owns authentication, authorization and every
business operation: the browser talks only to this service.

Postgres (hosted by Supabase) is the datastore, and the backend
connects to it directly with asyncpg. Supabase Storage and Realtime
remain in use for file uploads and live chat.

## Stack

- FastAPI + Pydantic v2
- uv-managed Python 3.12
- SQLAlchemy 2.0 (async) + asyncpg
- Argon2id password hashing (+ bcrypt for the migrated accounts) + PyJWT
- Alembic for schema drift checks (the SQL migrations own the schema)
- pytest + ruff + mypy

## Local development

### The database

The backend talks to Postgres directly, with SQLAlchemy. In development
that can be a local container instead of the Supabase project: it is
faster and it does not touch the real data.

```sh
# From the repository root.
./scripts/dev-db.sh up
```

It creates a Postgres container, applies the schema from
`supabase/migrations/`, loads the seed data, and prints the
`DATABASE_URL` to put in `backend/.env`. The seeded accounts use the
password `lumen-dev`:

| Account | Role |
| --- | --- |
| `admin6@cms.edu.co` | school admin of Colegio San Martin |
| `uber@edu.com` | school admin of Colegio San Juan |

To work against the **real** Supabase project instead, put its
connection string in `DATABASE_URL`. Copy it from the dashboard:
*Project Settings → Database → Connection string → URI*. Use the
"Session pooler" one. A bare `postgresql://` URL is fine: the backend
picks the async driver.

### The rest

```sh
cd backend
cp .env.example .env      # then fill in DATABASE_URL and JWT_SECRET
uv sync --extra dev       # install dependencies (requires uv >= 0.4)
uv run uvicorn app.main:app --reload --port 8000
```

`JWT_SECRET` signs the access tokens. Generate one with:

```sh
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### Verification

```sh
uv run pytest              # run the tests
uv run ruff check app tests
uv run ruff format --check app tests
uv run mypy
```

The tests need a Postgres. They use `TEST_DATABASE_URL`, or
`DATABASE_URL` when it is not set:

```sh
docker run -d --name lumen-test-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=lumen_test \
  -p 55432:5432 postgres:16-alpine

TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@127.0.0.1:55432/lumen_test" \
  uv run pytest
```

Without a database the pure-logic tests still run and the rest are
skipped.

## Layout

```
app/
  main.py            FastAPI app, middleware, exception handlers
  config.py          Pydantic settings (env)
  deps.py            FastAPI dependencies (session, context, role guards)
  academics/         periods, courses, subjects, assignments, enrollments
  auth/
    dependencies.py  JWT verification + current-user dependency
    operations.py    register, authenticate, sessions, password reset
    router.py        the auth endpoints
    schemas.py       request/response models
  chat/              conversations, members, messages
  content/           the material a teacher posts to a course subject
  core/
    access.py        the per-course-subject access checks
    context.py       the RequestContext: who is calling and what they may do
    pagination.py    the shared list envelope
    permissions.py   the permission checks (port of the SQL helpers)
    security.py      Argon2id password hashing
    tokens.py        access and refresh token issuance
    errors.py        domain exceptions and their HTTP mapping
  db/
    base.py          DeclarativeBase and shared column helpers
    enums.py         Python enums mirroring the Postgres enum types
    models/          one module per domain
    session.py       async engine, session factory, get_db dependency
  evaluations/       the authored assessments and their attempts
  grades/            the scores a teacher records and a student reads
  health.py          /health and /ready probes
  icfes/             the attempt lifecycle and the authoring
  notifications/      the in-app notifications of each user
  plans/             the subscription catalog
  schools/           the signup bootstrap (port of the SQL function)
  subscriptions/     Wompi checkout and webhook
  tasks/             the assignments and their submissions
  users/             Invitations and identity operations
  wompi/             Wompi HTTP client
alembic/             Drift-check scaffolding (the SQL migrations own the schema)
tests/               pytest suite
Dockerfile           multi-stage production image
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET  | `/health` | liveness probe |
| GET  | `/ready` | readiness probe (database + schema check) |
| POST | `/v1/auth/register` | create an account and sign in |
| POST | `/v1/auth/login` | exchange a password for a session |
| POST | `/v1/auth/refresh` | exchange a refresh token for a new pair |
| POST | `/v1/auth/logout` | revoke a refresh token |
| GET  | `/v1/auth/me` | the caller's session context |
| POST | `/v1/auth/forgot-password` | start the password-reset flow |
| POST | `/v1/auth/reset-password` | set a new password with a reset token |
| POST | `/v1/auth/verify-email` | consume an email-verification token |
| POST | `/v1/schools/bootstrap` | create a school for the caller, with a trial subscription |
| GET  | `/v1/academics/periods` | the school's academic periods |
| POST | `/v1/academics/periods` | create a period |
| PATCH | `/v1/academics/periods/{id}` | update a period |
| DELETE | `/v1/academics/periods/{id}` | delete a period |
| GET  | `/v1/academics/courses` | the school's courses, with their counts |
| POST | `/v1/academics/courses` | create a course |
| PATCH | `/v1/academics/courses/{id}` | update a course |
| DELETE | `/v1/academics/courses/{id}` | delete a course |
| GET  | `/v1/academics/subjects` | the school's subjects |
| POST | `/v1/academics/subjects` | create a subject |
| PATCH | `/v1/academics/subjects/{id}` | update a subject |
| DELETE | `/v1/academics/subjects/{id}` | delete a subject |
| GET  | `/v1/academics/course-subjects` | the school's course subjects, with their names |
| POST | `/v1/academics/course-subjects` | offer a subject in a course |
| PATCH | `/v1/academics/course-subjects/{id}` | update a course subject |
| DELETE | `/v1/academics/course-subjects/{id}` | remove a subject from a course |
| GET  | `/v1/academics/teacher-assignments` | the school's teacher assignments |
| POST | `/v1/academics/teacher-assignments` | assign a teacher to a course subject |
| PATCH | `/v1/academics/teacher-assignments/{id}` | update an assignment |
| DELETE | `/v1/academics/teacher-assignments/{id}` | remove an assignment |
| GET  | `/v1/academics/student-enrollments` | the school's enrollments |
| POST | `/v1/academics/student-enrollments` | enroll a student in a course |
| PATCH | `/v1/academics/student-enrollments/{id}` | update an enrollment |
| DELETE | `/v1/academics/student-enrollments/{id}` | remove an enrollment |
| GET  | `/v1/academics/members` | the school's members, joined with their profile |
| POST | `/v1/users/invitations` | create one user + profile + membership |
| POST | `/v1/users/bulk-upload` | create up to 500 invitations in one call |
| GET  | `/v1/users/memberships` | the caller's active memberships |
| POST | `/v1/subscriptions/checkout` | start a Wompi hosted-checkout session |
| POST | `/v1/subscriptions/portal` | return the Wompi customer-portal URL |
| GET  | `/v1/subscriptions` | current subscription + entitlements for the caller's school |
| POST | `/v1/webhooks/wompi` | Wompi event webhook (signature-verified, idempotent) |
| POST | `/v1/icfes/simulations/{id}/attempts` | start an attempt; returns questions (no keys) |
| POST | `/v1/icfes/attempts/{id}/finalize` | submit answers, score, persist |
| GET  | `/v1/icfes/comparisons` | per-simulation aggregates (teacher view) |
| GET  | `/v1/notifications` | the caller's notifications, newest first |
| GET  | `/v1/notifications/unread-count` | how many notifications are unread |
| POST | `/v1/notifications/{id}/read` | mark one notification as read |
| POST | `/v1/notifications/read-all` | mark every unread notification as read |
| DELETE | `/v1/notifications/{id}` | dismiss a notification |
| GET  | `/v1/notifications/preferences` | what the caller wants to be told about |
| PATCH | `/v1/notifications/preferences` | change what the caller wants to be told about |

## Notifications

A notification is a row addressed to one user inside one school. The
recipient is what scopes every read: the endpoints filter on the
caller, never on an id the browser sent, and a notification that
belongs to somebody else is a **404** rather than a 403, so the ids of
the other tenants cannot be probed.

The rows are not written by an endpoint. The domain modules create them
when something happens, through `app/notifications/service.py`:

| Event | Who is told |
| --- | --- |
| a task is posted | the students enrolled in the course |
| a submission arrives | the teachers of the course subject |
| a submission is graded | the student who submitted it |
| content is published | the students enrolled in the course |
| a chat message is sent | the other members of the conversation |

Each trigger runs inside the transaction of the operation that caused
it, so a notification exists exactly when the event does. The wording
and the link are part of the row: the backend knows the recipient and
their role, so it can point at the page that recipient has to open.

The bell of the app shell polls `unread-count`. The delivery by email
is not implemented yet: it needs a provider that this repository does
not have.

### The preferences

`notification_preferences` holds one row per (user, kind) with two
channels: `in_app` and `email`. A user without a row gets the
defaults — everything inside the app, nothing by email — so the API
always answers with one entry per kind.

The preferences are personal, not tenant scoped: a user who belongs to
two schools keeps the same preferences in both. They are honoured when
the notification is created: a user who turned a kind off inside the
app does not get it. The email column is the preference for a channel
that does not exist yet; it is already where the provider will look.

`PATCH /v1/notifications/preferences` takes the changes to apply:

```json
{ "preferences": [{ "kind": "task_graded", "in_app": false }] }
```

Only the channels that are sent are changed: turning the app
notifications off leaves the email ones alone.

## Authentication

The backend owns authentication. Supabase Auth is no longer involved.

- **Passwords** are hashed with Argon2id. The parameters live in
  `Settings` and can be tuned without a code change. The bcrypt hashes
  of the accounts migrated from Supabase Auth are still accepted, and
  the first successful login rehashes them to Argon2id, so the legacy
  format drains itself.
- **Access tokens** are HS256 JWTs signed with `JWT_SECRET`. They
  last 15 minutes by default and carry only the user id and the
  email.
- **Refresh tokens** are opaque random strings. Only their SHA-256
  hash is stored, so a database leak does not hand out valid
  sessions. They last 30 days by default.

**The browser's session lives in httpOnly cookies.** The page's
JavaScript cannot read them, so an XSS cannot steal them. The browser
sends them with `credentials: "include"`; the server functions read
them from the incoming request and forward them as an
`Authorization: Bearer` header. The API accepts either.

Set `COOKIE_DOMAIN` (for example `.example.com`) when the frontend
and the API live on different subdomains, so the frontend's server
can read the cookie during SSR. Leave it empty when they share a
host. In development it can stay empty: cookies ignore the port, so
`localhost` covers both.

Two properties the tests enforce:

- **A refresh token is single-use.** Rotating it revokes the old one.
  Presenting an already-used token revokes *every* session of that
  user, because it means either a stale client or a replayed stolen
  token. The revocation is committed even though the request fails.
- **A password reset revokes every session**, so a reset really does
  lock out whoever held the old password.

Neither the login nor the forgot-password flow reveals whether an
account exists: the responses are identical either way, so the
endpoints cannot be used to enumerate accounts.

### Storage and Realtime

Storage and Realtime stay on Supabase, and their RLS policies call
`auth.uid()`. The bridge is a short-lived token the backend mints
(`POST /v1/auth/supabase-token`), whose `sub` is the caller's id:
with it, every storage and realtime policy works unchanged.

The token is not an authentication token: the API refuses it. It
lasts an hour, and the browser asks for a new one when it expires.
The browser cannot mint it itself: signing it would mean exposing the
project JWT secret.

## Database

**The SQL migrations under `supabase/migrations/` are the single owner
of the schema**, including the identity table the backend uses for
authentication (`public.users`, which replaces `auth.users`) and its
session tables. They are applied with `supabase db push`, and nothing
else creates production tables.

The backend checks the schema at startup and refuses to run when a
migration was not applied:

```
The database is missing 3 table(s): refresh_tokens, ...
The SQL migrations under supabase/migrations/ have not been applied.
Run `supabase db push` (or apply them with psql).
```

`GET /ready` reports the same thing, so a deployment that skipped the
migrations shows up as not-ready instead of answering 500 to every
request.

Alembic is not a second source of migrations. `backend/alembic/` is
scaffolding for `alembic revision --autogenerate`, which diffs the
SQLAlchemy models against a live database; the generated revision is
translated into a SQL migration and then deleted. See
`alembic/versions/README.md`.

`tests/test_schema_drift.py` compares the models against the SQL
migrations, and `tests/test_migrations.py` applies the migrations to a
fresh database and checks the result, so a mismatch fails the build
instead of surfacing as a runtime error.

The `local-shim.sql` script under `supabase/` creates stand-ins for
the Supabase platform objects (`auth` schema, `storage` schema, the
`authenticated` role) so the SQL migrations can also be applied to a
plain Postgres container. It must not be run against a real Supabase
project.

## Conventions

- Pure functional style: routers stay thin, business logic lives in
  `operations.py` / `scoring.py` modules. Keep the score math
  deterministic so unit tests can use fixtures.
- **Tenant isolation**: `school_id` is never taken from a request
  body. It is derived from the caller's own memberships and the
  resource being addressed.
- The Wompi webhook handler MUST verify the signature before touching
  the database. Idempotency is enforced by inserting into
  `wompi_events_processed` with `ON CONFLICT DO NOTHING`.
- Secrets come from `pydantic-settings` (`SecretStr` for tokens).
  Never log or trace them.
- Tests are pytest. Database-backed tests run against a real
  Postgres; the pure-logic tests do not need one.

## Permissions

Until Phase 2, Row Level Security was the only thing standing between
one school's data and another's. With the CRUD moving into the
backend, RLS is no longer in the path, so the checks it performed
live in Python instead.

`app/core/permissions.py` is the port of the seven `SECURITY DEFINER`
helpers the migrations declared. The behaviour is preserved exactly,
including the subtle parts: a revoked membership grants nothing, a
withdrawn enrollment is not an active enrollment, and the ICFES
entitlement counts only while the subscription is active or on trial.

`app/core/context.py` holds the `RequestContext`: the caller's
identity, their active memberships and their platform role, loaded
once per request. The routers read the school from it, never from the
request body.

Two rules the code follows:

- **The `school_id` in a request body is only ever used to look up a
  membership.** It never grants access on its own.
- **A caller who does not belong to a school gets a 404, not a 403.**
  A 403 would confirm that the school exists, so the endpoint could
  be used to probe for other tenants' ids. A caller who *does* belong
  to the school but with the wrong role gets a 403: they already know
  it exists.

`tests/test_tenant_isolation.py` covers the cross-tenant scenarios:
a caller from one school cannot read or write anything belonging to
another.

## Migration status

The backend is being migrated from a Supabase-hosted design to a
Python-only one. See `ARCHITECTURE.md` at the repository root for the
full plan.

- **Phase 0 (done)** — the Supabase SDK is gone. The backend talks to
  Postgres directly through SQLAlchemy. All the tables are modelled.
- **Phase 1 (done)** — the auth endpoints: register, login, refresh,
  logout, the password-reset flow, email verification, and
  `bootstrap_school` as a Python function. The legacy Supabase token
  path was removed: the backend is the only issuer of tokens.
- **Phase 2 (done)** — the permission layer: the seven SQL helper
  functions reimplemented in Python, plus the request context that
  carries the caller's memberships. The routers now resolve their
  school from that context.
- **Phase 3 (done)** — the domain endpoints: the CRUD that the
  browser used to do directly against PostgREST. Every module is
  covered: academics, content, tasks, grades, evaluations, the ICFES
  bank and simulations, chat, and the plan catalog.

  The permissions follow the RLS policies the migrations declared.
  Two of them are finer-grained than "member of the school": the
  content, task, grade and evaluation modules check the *course
  subject*, so a teacher only reaches their own material and a
  student only reaches the courses they are enrolled in.

  The answer keys — of the evaluations and of the ICFES bank — never
  reach a student. The scoring happens on the server, which is why
  those attempt lifecycles live in the backend rather than in the
  browser.
- **Phase 4 (done)** — the frontend. The browser talks only to this
  API: the Supabase client is gone from the data path, and the hooks
  are rewritten against the endpoints above. Storage and Realtime stay
  on Supabase, isolated in `lib/supabase/client.ts` and reached with
  the short-lived token the backend mints.
