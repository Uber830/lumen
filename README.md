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
| **Plataforma** | Colegios, catálogo editorial, soporte |
| **Admin de colegio** | Panel del colegio: dashboard, contenido, comunidad, ciclo, ICFES, identidad y soporte |
| **Docente** | Materias, calificaciones, tareas, evaluaciones, ICFES, chat |
| **Estudiante** | Clases, notas, tareas, evaluaciones, materiales, ICFES, chat |

Este README es el mapa del proyecto: cómo se levanta y dónde está cada cosa.
El detalle de cada entorno vive en su propio README.

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
contraseña **`lumen-dev`**. Estas cuatro recorren el ciclo completo de la
aplicación:

| Correo | Rol | Colegio | Vistas |
| --- | --- | --- | --- |
| `super@lumen.co` | Plataforma | — | `/super`, `/super/colegios`, `/super/catalogo`, `/super/soporte` |
| `ana.restrepo@sagcor.edu.co` | Admin de colegio | Sagrado Corazón | `/admin`, `/admin/cursos`, `/admin/docentes`, `/admin/estudiantes`, `/admin/asignaciones`, `/admin/soporte`, `/admin/periodos`, `/admin/icfes` |
| `docente01@sagcor.edu.co` | Docente | Sagrado Corazón | `/docente`, `/docente/materia`, `/docente/calificaciones`, `/docente/icfes` |
| `estudiante001@sagcor.edu.co` | Estudiante | Sagrado Corazón | `/estudiante`, `/estudiante/materiales`, `/estudiante/tareas`, `/estudiante/notas`, `/estudiante/evaluaciones` |

Otras cuentas de la semilla: `admin6@cms.edu.co` (Colegio San Martín),
`uber@edu.com` (Colegio San Juan), `docente@lumen.co` y
`estudiante@lumen.co` (Shared ICFES Bank), `admin@cms.edu.co` …
`admin5@cms.edu.co` (cuentas sin colegio).

Si una de las cuatro cuentas deja de entrar —cambiaste la contraseña,
borraste la membresía o la base se reconstruyó a medias— se deja
arreglada con:

```bash
./scripts/dev-accounts.sh
```

El script es idempotente: restablece la contraseña, asegura el rol de
plataforma y las membresías del colegio de la demo.

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
| La primera carga dice «Esta página no cargó» | Vite está re-optimizando las dependencias | recarga la página |

---

## Estructura

```
backend/          API FastAPI
frontend/         app React (TanStack Start)
supabase/         migraciones y semilla heredadas del proyecto original
scripts/          dev-db.sh (la base local) y dev-accounts.sh (las cuentas)
docs/             las decisiones de producto, por parte
docker-compose.yml servicio Postgres
```

**El esquema SQL es propiedad de las migraciones**: las heredadas en
`supabase/migrations/` y las de este proyecto en `backend/migrations/`, que se
aplican en ese orden. No se edita a mano la base: se escribe una migración y
se corre `./scripts/dev-db.sh reset`.

---

## Documentación

| Dónde | Qué hay |
| --- | --- |
| [backend/README.md](backend/README.md) | la API: endpoints, autenticación, permisos, esquema y pruebas |
| [frontend/README.md](frontend/README.md) | la app: rutas, sesión, el logo, pruebas y convenciones |
| [docs/colegio.md](docs/colegio.md) | el rol de administrador de colegio: vistas, permisos y decisiones |
| [docs/catalogo.md](docs/catalogo.md) | el catálogo editorial: ciclo de vida, cobertura y reglas |
| [docs/site-style-guide.md](docs/site-style-guide.md) | la dirección visual del sitio público (landing y acceso) |
