# Lumen

**La biblioteca que ilumina.** Plataforma educativa donde el superadministrador
carga el contenido —recursos, libros, material de apoyo— y docentes y
estudiantes lo consultan desde un módulo común.

Lumen nace como una base independiente a partir de **EduSuite**, del mismo modo
en que EduSuite nació de un brief de producto. Conserva toda la arquitectura
probada (multi-tenant, RLS, JWT propio, Argon2id, planes de suscripción) y
suma un objetivo propio: **acumular y distribuir contenido académico de
calidad**, cargado una sola vez por la plataforma y disponible para todos los
colegios que contratan el servicio.

---

## Qué hay aquí

El código base es una plataforma de gestión académica multi-colegio con cuatro
roles y sus módulos correspondientes:

| Rol | Módulos |
| --- | --- |
| **Super Admin** | Métricas de plataforma, colegios, planes |
| **Admin de colegio** | Usuarios, cursos, materias, asignaciones, períodos, personalización, planes |
| **Docente** | Materias, calificaciones, tareas, evaluaciones, ICFES, chat |
| **Estudiante** | Clases, notas, tareas, evaluaciones, materiales, ICFES, chat |

El **módulo de contenido de plataforma** (recursos y libros cargados por el
superadmin, visibles para docentes y estudiantes) es la funcionalidad propia
de este proyecto y se construye sobre la base heredada.

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 · TypeScript 6 · TanStack Start / Router · Vite 8 · Tailwind 4 |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 (async) · asyncpg · Pydantic 2 |
| Base de datos | PostgreSQL 16 (Docker en local) |
| Autenticación | JWT propio (HS256) + Argon2id, cookies httpOnly |
| Pagos | Wompi (sandbox) |
| Storage / Realtime | Supabase (opcional, solo para archivos y chat en vivo) |

---

## Puesta en marcha

### 1. Base de datos

El Postgres corre en Docker. El compose y el script de esquema están
configurados para el puerto **55440**, así que Lumen convive con la pila de
EduSuite (que usa 55432) en la misma máquina.

```bash
docker compose up -d db      # levanta el contenedor
./scripts/dev-db.sh up       # crea el esquema y carga los datos semilla
```

`dev-db.sh up` aplica `supabase/local-shim.sql` (los objetos de plataforma
que asumen las migraciones), las 29 migraciones de `supabase/migrations/` en
orden y `supabase/seed.sql`. La cadena de conexión que imprime es la que va
en `backend/.env`:

```
postgresql://postgres:postgres@127.0.0.1:55440/lumen_dev
```

Otros comandos: `./scripts/dev-db.sh reset` (recrea desde cero) y
`./scripts/dev-db.sh down` (detiene el contenedor; el volumen sobrevive).

### 2. Backend

```bash
cd backend
uv sync --extra dev
uv run lumen-api            # http://localhost:8010
```

### 3. Frontend

```bash
cd frontend
npm ci
npm run dev                 # http://localhost:5174
```

### Puertos

| Servicio | Puerto | Nota |
| --- | --- | --- |
| API (FastAPI) | 8010 | 8000 lo usa EduSuite |
| Frontend (Vite) | 5174 | 8080 lo usa EduSuite |
| Postgres | 55440 | 55432 lo usa EduSuite |

---

## Cuentas de desarrollo

El seed carga todas las cuentas con la contraseña **`lumen-dev`**:

| Correo | Rol | Colegio |
| --- | --- | --- |
| `super@lumen.co` | Super Admin de plataforma | — |
| `docente@lumen.co` | Docente | Shared ICFES Bank |
| `estudiante@lumen.co` | Estudiante | Shared ICFES Bank |
| `admin@cms.edu.co` | Administrador de colegio | — |
| `admin1@cms.edu.co` … `admin6@cms.edu.co` | Administradores de colegio | — |
| `uber@edu.com` | Administrador de colegio | Colegio San Juan |

Las tres primeras son las que usa el módulo de contenido: el super admin
carga, el docente y el estudiante consultan.

> **Nota para el módulo de contenido de plataforma.** El endpoint heredado
> `GET /v1/content/items` está anclado a un colegio: llama a
> `require_any_membership()`, así que el super admin —que no pertenece a
> ningún colegio— recibe un 403. El contenido de plataforma necesita un
> endpoint propio, **no** anclado a una membresía escolar, con su propia
> autorización.

---

## Estructura

```
backend/          API FastAPI
  app/
    auth/         login, JWT, cookies, dependencias de sesión
    content/      contenido por materia (base del módulo de plataforma)
    db/           modelos SQLAlchemy, sesión, verificación de esquema
    schools/      colegios, cursos, materias, asignaciones
    users/        usuarios y membresías
    icfes/        banco de preguntas y simulacros
    plans/        planes y suscripciones (Wompi)
  alembic/        entorno Alembic (el esquema vive en supabase/migrations)
  tests/          pytest
frontend/         app React (TanStack Start)
  src/routes/     rutas por rol
  src/features/   lógica por módulo
  src/lib/        cliente API, auth, tema, storage
supabase/
  migrations/     dueño único del esquema SQL
  seed.sql        datos de desarrollo
  local-shim.sql  objetos de plataforma para Postgres sin Supabase
scripts/dev-db.sh ciclo de vida de la base local
docker-compose.yml servicio Postgres
```

**El esquema SQL es propiedad de `supabase/migrations/`.** No se edita a mano
la base: se escribe una migración y se corre `./scripts/dev-db.sh reset`.

---

## El sitio público

La landing (`/`) y la pantalla de acceso (`/login`) tienen su propia dirección
visual, **«El Índice»**: papel claro, retícula de cuaderno, monoespaciada para
las etiquetas y botones rectangulares. La guía de estilo completa está en
[`docs/site-style-guide.md`](docs/site-style-guide.md).

### El contenido vive en la base

Nada del texto de la landing está en el frontend: todo llega de
`GET /v1/public/site`.

```bash
curl http://localhost:8010/v1/public/site
```

La respuesta trae las cifras, el catálogo editorial y el copy completo de las
ocho secciones. El copy se guarda en la fila `landing` de `site_content` y el
catálogo en `catalog_items` y `catalog_item_schools`, así que el equipo de
plataforma edita la página sin redesplegar:

```sql
select content from public.site_content where key = 'landing';
```

> Los nombres de los colegios del catálogo se escriben a mano, uno por uno:
> publicar un cliente es una decisión explícita, nunca un efecto colateral.
> La pantalla de acceso muestra filas de ejemplo, no clientes reales.

### Editar la semilla

```bash
./scripts/dev-db.sh reset   # aplica las migraciones y la semilla de nuevo
```

### La protección del acceso

`POST /v1/auth/login` responde siempre lo mismo cuando las credenciales no
cuadran —`El correo o la contraseña no coinciden.`— para que no sirva de
enumerador de cuentas. Además:

- **5 intentos por minuto** y por par (correo, dirección) → `429` con
  `Retry-After`;
- **10 fallos** bloquean la cuenta 15 minutos → `423`;
- cada intento queda en `login_attempts`, con el correo hasheado.

Los tres valores se ajustan por entorno: `LOGIN_RATE_LIMIT_ATTEMPTS`,
`LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_LOCK_THRESHOLD` y
`LOGIN_LOCK_MINUTES`.

---

## Comandos

```bash
# Backend
uv run pytest                       # tests
uv run ruff format .                # formato
uv run ruff check .                 # lint
uv run mypy app                     # tipos

# Frontend
npm run dev                         # servidor de desarrollo
npm run build                       # build de producción
npm run typecheck                   # tsc --noEmit
npm run lint                        # eslint
npm run test                        # vitest
```

---

## Documentación heredada

`ARCHITECTURE.md` y `AUDIT.md` provienen de EduSuite y describen la
arquitectura con detalle: modelo multi-tenant, RLS, planes, ICFES, Wompi. Se
mantienen como referencia del código heredado.

---

## Estado

Base heredada de EduSuite, renombrada y montada de forma independiente: esquema
propio en Docker, secretos propios, historia de Git propia y sin remoto.
