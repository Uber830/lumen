# Flujo de trabajo del proyecto

Reglas que el agente debe seguir al trabajar en este repositorio.
Aplican sin importar qué modelo LLM se esté usando.

## Idioma

- Respondé y escribí commits, PRs y comentarios de usuario en español.
- El código, los nombres y los comentarios dentro del código van en inglés.

## Ramas y worktrees

- `main` es la rama estable: siempre debe compilar y pasar los tests.
  Nunca commitear directo a `main`; se integra vía Pull Request.
- Una rama por **tarea** (feature o fix), de vida corta (días, no semanas).
  Nombres: `feat/<descripcion-corta>` o `fix/<descripcion-corta>`.
- NO crear ramas de larga vida por rol (docente, estudiante, etc.):
  los roles comparten backend y chocan al mergear.
- Los worktrees son para trabajar tareas en paralelo sin cambiar de rama.
  Una vez la rama se mergea a `main`, esa rama se borra; el directorio del
  worktree se reutiliza para la siguiente tarea.

## Al empezar una tarea

1. Partir siempre de `main` actualizada (`git switch main && git pull`).
2. Crear la rama de la tarea: `git switch -c feat/<nombre>`.
3. Si la tarea es independiente de otra en curso, usar un worktree.

## Durante la tarea

- Antes de tocar código que no conocés, leelo; no asumas su forma.
- Cada módulo expone sus tipos en su propio `types.ts`; los hooks importan
  de ahí, sin tipos inline. `lib/api/types.ts` solo tiene auth y enums
  compartidos.
- Al cambiar el esquema de la base, agregá una migración en
  `supabase/migrations/` y actualizá el modelo SQLAlchemy. Columnas
  agregadas por `ALTER TABLE` deben registrarse en el test de schema drift.

## Antes de dar una tarea por terminada

- Frontend: `npx tsc --noEmit`, `npx eslint src --quiet`, `npx vitest run`
  y `npm run build`, todo en verde.
- Backend: `uv run ruff check` y `uv run pytest` (con `TEST_DATABASE_URL`
  apuntando a la base de test local), en verde.
- No marcar como terminado si algo de lo anterior falla.

## Commits

- Formato: `<emoji> <tipo>(<scope>): <título corto y directo>`.
  Ejemplo: `✨ feat(perfil): editar apellido, correo y foto`.
- Cuerpo opcional: 2-3 viñetas cortas con lo esencial. No extenso.
- Commits atómicos: uno por intención. No mezclar features distintas.
- Emojis por tipo: ✨ feat · 🐛 fix · ♻️ refactor · ✅ test · 🎨 estilo/UI
  · 🔧 chore/config · 🌓 feature de tema · 🔀 merge.
- No commitear secretos (`.env`, llaves). No hacer push forzado a `main`.

## Integración (merge a main)

- Antes del PR: traer `main` a la rama (`git merge main`), resolver
  conflictos en la rama, y verificar que compila y testea ahí.
- Integrar de forma secuencial cuando varias ramas tocan archivos comunes.
- `routeTree.gen.ts` es autogenerado: ante conflicto, regenerarlo con el
  dev server/build, no editarlo a mano.
- PR → revisión → merge. Luego borrar la rama.
