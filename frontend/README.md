# Lumen frontend

La app de Lumen: TypeScript + React 19 + Vite, con TanStack Start para las
rutas por archivo y TanStack Query para la caché de estado de servidor.

**Todos los datos pasan por el backend FastAPI** que está en `../backend/`.
El navegador no habla con la base de datos: el backend es el dueño de la
autenticación, la autorización y cada regla de negocio. La única excepción
son Supabase Storage y Realtime, que siguen en Supabase y se alcanzan con un
token corto que acuña el backend.

- [Arranque rápido](#arranque-rápido)
- [Layout](#layout)
- [Rutas](#rutas)
- [La sesión](#la-sesión)
- [El logo](#el-logo)
- [El sitio público](#el-sitio-público)
- [Pruebas](#pruebas)
- [Convenciones](#convenciones)

---

## Arranque rápido

```sh
# 1. El backend tiene que estar levantado (ver ../backend/README.md)
cd ../backend && uv run lumen-api       # http://localhost:8010

# 2. La configuración del frontend
cd ../frontend
cp .env.example .env                     # VITE_API_URL=http://localhost:8010

# 3. Las dependencias y el servidor
npm ci
npm run dev                              # http://localhost:5174
```

Si el puerto 5174 está ocupado, Vite toma el 5175; el backend permite los dos
orígenes. Si prefieres que falle en vez de moverse, el puerto está en
`vite.config.ts`.

### Variables de entorno

Viven en `frontend/.env` (está en `.gitignore`; se crea a partir de
`frontend/.env.example`). Todas son públicas: acaban en el bundle, así que
aquí no va nada secreto.

| Variable | Para qué |
| --- | --- |
| `VITE_API_URL` | la URL base del backend. Por defecto `http://localhost:8010` |
| `VITE_SITE_URL` | la URL canónica del sitio público (Open Graph, canonical) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | solo Storage y Realtime; se pueden dejar vacías en local |
| `VITE_WOMPI_PUBLIC_KEY` | el checkout de Wompi; vacío en local |

Si `VITE_API_URL` no está, el cliente usa `http://localhost:8010` como
respaldo. Si apunta a otro puerto, el frontend no carga datos y la consola
muestra errores de red.

---

## Layout

```
public/                 recursos estáticos (favicon, manifiesto, imagen OG)
scripts/                los generadores de iconos e imagen de compartir
src/
  components/           UI reutilizable (app-shell, brand-logo, icfes/*, ui/*, chat-panel, …)
  features/             lógica por módulo
    site/               el sitio público: landing y acceso
      components/       una pieza por sección
      site.css          los tokens y la retícula del diseño «El Índice»
      types.ts          el contrato del contenido que llega de la API
      use-site-content.ts  la única llamada al endpoint del sitio
  hooks/                use-mobile, use-plan
  lib/
    api/                el cliente de la API y los tipos de respuesta
    auth/               la sesión: auth del navegador, funciones de servidor, guardas
    billing/            useEntitlement, useStartCheckout, catálogo de planes
    grades/             useStudentGrades
    icfes/             useStartIcfesAttempt, useFinalizeIcfesAttempt
    schemas/            esquemas zod (validación de formularios)
    storage/            subida de archivos y los hooks de contenido/tareas/chat
    supabase/           el cliente de Storage y Realtime
    users/              useInviteUser, useBulkInviteUsers, parseCsvInvitations
  routes/               rutas por archivo (cada .tsx es una ruta)
  routeTree.gen.ts      lo genera el plugin de TanStack Router
  router.tsx            la fábrica del router
  server.ts             el envoltorio de errores del SSR
  start.ts              el middleware de TanStack Start
  styles.css            la entrada de Tailwind
  types/                los tipos del dominio
tests/                  pruebas unitarias (Vitest) y e2e (Playwright)
```

`routeTree.gen.ts` se genera solo y no se edita a mano: lo regeneran
`npm run dev` y `npm run build`.

---

## Rutas

TanStack Start usa **rutas por archivo**: cada `.tsx` de `src/routes/` es una
ruta, y los puntos del nombre se convierten en barras
(`admin.docentes.tsx` → `/admin/docentes`).

```
index.tsx                     la landing pública
login.tsx                     la pantalla de acceso
admin.tsx + admin.<área>.tsx  el panel del administrador de colegio
docente.tsx + docente.<área>.tsx
estudiante.tsx + estudiante.<área>.tsx
super.tsx + super.<área>.tsx  el panel de plataforma
activar.tsx                   poner la contraseña con el enlace de activación
perfil.tsx + perfil.index.tsx el perfil del usuario
```

Los prefijos de rol son un archivo padre + sus hijos. El archivo padre
(`admin.tsx`, `docente.tsx`…) llama a `getCurrentSession` en `beforeLoad` y
comprueba el rol antes de renderizar nada. El patrón canónico está en
`src/routes/admin.tsx` y las guardas en `src/lib/auth/guards.ts`.

---

## La sesión

La sesión vive en una cookie httpOnly que pone el backend. El JavaScript de
la página no la puede leer, así que un XSS no se la puede llevar. Eso da
forma al código:

- **Entrar y salir pasan por el navegador** (`lib/auth/browser.ts`), porque la
  cookie tiene que llegar al navegador. El servidor del frontend la lee
  después, durante el SSR.
- **Leer la sesión pasa por el servidor** (`lib/auth/functions.ts`), con
  `createServerFn`. Las guardas de ruta lo llaman en `beforeLoad`.
- **Las llamadas a la API pasan por `lib/api/client.ts`**, que manda
  `credentials: "include"`. Ante un 401 refresca la sesión una vez y repite la
  petición, para que un token de quince minutos no interrumpa al usuario.

El login del sitio público (`/login`) es la pantalla nueva de acceso: valida
el correo en el cliente, manda `remember_me`, aplica el rate limit con cuenta
atrás y redirige según el rol (`/super`, `/admin`, `/docente`, `/estudiante`).
El parámetro `?next=` se respeta solo si es una ruta interna.

---

## El logo

Hay **un solo logo en toda la aplicación**: el sol de tinta del sitio
público. Vive en `src/components/brand-logo.tsx` y lo usan el sitio, el
acceso y la marca del panel de todos los roles (`app-shell.tsx`).

El SVG es el mismo en todas partes; lo que cambia es el color:

- el cuadrado toma el color de su surroundings (`currentColor`);
- los rayos se recortan contra la superficie que sostiene el logo
  (`--brand-cut`: el fondo del sitio, el rail del panel).

El escudo del colegio no es el logo de la aplicación: es la marca de cada
colegio, y el administrador la configura en Personalización.

---

## El sitio público

La landing (`/`) y el acceso (`/login`) tienen su propia dirección visual,
**«El Índice»**, y no comparten nada con el panel: tokens propios en
`features/site/site.css` (ámbito `.idx-site`), iconos SVG en línea y fuentes
auto-alojadas.

Nada del texto de la landing está en el frontend: todo llega de
`GET /v1/public/site` a través de `use-site-content.ts`, una sola llamada que
alimenta toda la página. Los componentes del panel usan los tokens globales
de Tailwind; los del sitio, los suyos.

La guía de estilo está en [`../docs/site-style-guide.md`](../docs/site-style-guide.md).

---

## Pruebas

```sh
npm run test        # Vitest (unitarias)
npm run test:e2e    # Playwright (levanta el dev server solo)
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm run build       # bundle de producción en .output/
```

Las e2e arrancan su propio servidor de desarrollo en el puerto 5174 (o el
`PORT` que se le pase). En una máquina sin las librerías de Chromium puede
harte falta:

```sh
LD_LIBRARY_PATH=/ruta/a/las/librerias npx playwright test
```

---

## Convenciones

- `__root.tsx` es la cáscara de la aplicación y envuelve cada página. Siempre
  con su `<Outlet />` y sus `<Scripts />`.
- TanStack Router admite segmentos dinámicos con el prefijo `$` (`$id.tsx`,
  `$.tsx`). El proyecto no los usa todavía.
- Si una página necesita un diálogo de confirmación, sigue el patrón
  `<dialog>` + `useState` de `src/routes/admin.docentes.tsx` y
  `src/components/confirm-dialog.tsx` en vez de meter una dependencia nueva.
- Los árboles de rol siguen el patrón padre + hijos; no anides más de lo que
  el rol necesita.
- La API devuelve snake_case y los componentes usan camelCase. La conversión
  ocurre una sola vez, en `lib/auth/functions.ts` (`SessionContext`) y en los
  hooks que necesitan números (`lib/grades/student.ts`). No la repartas por
  los componentes.
- Los tipos de respuesta viven en `lib/api/types.ts` y reflejan los esquemas
  Pydantic del backend. Cuando cambia una respuesta, el documento OpenAPI
  (`/openapi.json`) cambia con ella.
- Sin librerías nuevas: lo que el proyecto no usa, no se añade.
