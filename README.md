# Lumen

**La biblioteca que ilumina.** Plataforma educativa multi-colegio: el equipo de
plataforma carga el contenido editorial y lo habilita colegio por colegio;
docentes y estudiantes lo consultan desde un módulo común.

Lumen nace como una base independiente a partir de **EduSuite**. Conserva su
arquitectura probada (multi-tenant, JWT propio, Argon2id, planes de
suscripción) y suma un objetivo propio: **acumular y distribuir contenido
académico de calidad**, cargado una sola vez por la plataforma y disponible
para todos los colegios que contratan el servicio.

| Rol | Módulos |
| --- | --- |
| **Plataforma** | Colegios, planes, contenido editorial |
| **Admin de colegio** | Usuarios, cursos, materias, asignaciones, períodos |
| **Docente** | Materias, calificaciones, tareas, evaluaciones, ICFES, chat |
| **Estudiante** | Clases, notas, tareas, evaluaciones, materiales, ICFES, chat |

---

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | React 19 · TypeScript · TanStack Start / Router · Vite · Tailwind 4 |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2 (async) · asyncpg · Pydantic 2 |
| Base de datos | PostgreSQL 16 (Docker en local) |
| Autenticación | JWT propio (HS256) + Argon2id, cookies httpOnly |
| Pagos | Wompi (sandbox) |
| Storage / Realtime | Supabase (opcional, solo para archivos y chat en vivo) |

---

## Puesta en marcha

### Requisitos

- **Docker** (para el Postgres de desarrollo)
- **uv** ≥ 0.4 (Python) — `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Node** ≥ 20 y npm

### 0. Preparar los dos `.env`

Los dos `.env` están en `.gitignore`: hay que crearlos a partir de los
ejemplos. **Sin esto el backend no arranca y el frontend no encuentra la API.**

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 1. Base de datos

```bash
./scripts/dev-db.sh up
```

Levanta el contenedor Postgres, aplica las migraciones y carga la semilla.
Imprime la cadena de conexión, que es la que va en `backend/.env`:

```
postgresql://postgres:postgres@127.0.0.1:55440/lumen_dev
```

Abre `backend/.env` y pega ese valor en `DATABASE_URL`. Rellena también
`JWT_SECRET` (firma los tokens):

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
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

### 4. Entrar

`http://localhost:5174/login`. Todas las cuentas de la semilla usan la
contraseña **`lumen-dev`**:

| Correo | Rol | Colegio |
| --- | --- | --- |
| `super@lumen.co` | Plataforma | — |
| `admin6@cms.edu.co` | Admin de colegio | Colegio San Martín |
| `uber@edu.com` | Admin de colegio | Colegio San Juan |
| `docente@lumen.co` | Docente | Shared ICFES Bank |
| `estudiante@lumen.co` | Estudiante | Shared ICFES Bank |
| `admin@cms.edu.co` … `admin5@cms.edu.co` | Cuentas sin colegio | — |

El acceso redirige según el rol: `/super`, `/admin`, `/docente`,
`/estudiante`. **Nadie se registra solo**: el equipo de plataforma da de alta
los colegios (ver [backend/README.md](backend/README.md)).

### Puertos

| Servicio | Puerto | Nota |
| --- | --- | --- |
| API (FastAPI) | 8010 | 8000 lo usa EduSuite |
| Frontend (Vite) | 5174 | si está ocupado, Vite toma 5175 (el backend lo permite) |
| Postgres (dev) | 55440 | 55432 lo usa EduSuite |
| Postgres (test) | 55441 | lo crea el README del backend |

---

## Si algo no funciona

| Síntoma | Causa habitual | Comprobación |
| --- | --- | --- |
| El backend dice que no hay base de datos | falta `DATABASE_URL` en `backend/.env` | `curl http://localhost:8010/ready` |
| El backend dice que faltan tablas | las migraciones no se aplicaron | `./scripts/dev-db.sh reset` |
| El frontend no carga datos | `VITE_API_URL` apunta a otro puerto | debe ser `http://localhost:8010` |
| La consola dice «CORS» | el origen del frontend no está en `CORS_ALLOWED_ORIGINS` | debe incluir `http://localhost:5174` |
| El login responde 429 | se agotaron los 5 intentos por minuto | espera un minuto |
| `npm run dev` dice que el puerto está ocupado | hay otra instancia de Vite | `lsof -i :5174` |

---

## Estructura

```
backend/          API FastAPI
  app/            módulos por dominio (auth, schools, academics, site, …)
  migrations/     migraciones SQL propias del proyecto
  seeds/          datos semilla propios del proyecto
  alembic/        andamiaje para el diff de esquema (el esquema vive en SQL)
  tests/          pytest
frontend/         app React (TanStack Start)
  src/routes/     rutas por rol
  src/features/   lógica por módulo
  src/lib/        cliente API, auth, tema, storage
supabase/
  migrations/     migraciones heredadas del proyecto original
  seed.sql        datos de desarrollo heredados
  local-shim.sql  objetos de plataforma para Postgres sin Supabase
scripts/dev-db.sh ciclo de vida de la base local
docker-compose.yml servicio Postgres
```

**El esquema SQL es propiedad de las migraciones**: las heredadas en
`supabase/migrations/` y las de este proyecto en `backend/migrations/`, que se
aplican en ese orden. No se edita a mano la base: se escribe una migración y
se corre `./scripts/dev-db.sh reset`.

---

## Documentación por parte

- [backend/README.md](backend/README.md) — la API: módulos, endpoints,
  autenticación, permisos, esquema y pruebas.
- [frontend/README.md](frontend/README.md) — la app: rutas, sesión, variables
  de entorno y pruebas.
- [docs/site-style-guide.md](docs/site-style-guide.md) — la dirección visual
  del sitio público (landing y acceso).
- `ARCHITECTURE.md` y `AUDIT.md` — material heredado de EduSuite, se
  mantienen como referencia del código heredado.

---

## Comandos

```bash
# Backend (desde backend/)
uv run pytest                # tests
uv run ruff format .         # formato
uv run ruff check .          # lint
uv run mypy app              # tipos

# Frontend (desde frontend/)
npm run dev                  # servidor de desarrollo
npm run build                # build de producción
npm run typecheck            # tsc --noEmit
npm run lint                 # eslint
npm run test                 # vitest
npm run test:e2e             # playwright
```

---

## El sitio público

La landing (`/`) y la pantalla de acceso (`/login`) tienen su propia dirección
visual, **«El Índice»**. Nada del texto de la landing está en el frontend:
todo llega de `GET /v1/public/site`, así que el equipo de plataforma edita la
página sin redesplegar.

```bash
curl http://localhost:8010/v1/public/site
```

> Los nombres de los colegios del catálogo se escriben a mano, uno por uno:
> publicar un cliente es una decisión explícita, nunca un efecto colateral.
> La pantalla de acceso muestra filas de ejemplo, no clientes reales.
