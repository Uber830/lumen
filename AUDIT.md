# Auditoría técnica de Lumen

Fecha: 2026-08-02  
Repositorio auditado: `lumen`  
Alcance: estado actual del código antes de introducir Supabase o el backend FastAPI.

> Conclusión ejecutiva: el repositorio es un prototipo visual navegable de alta fidelidad. Tiene un frontend moderno y una capa SSR mínima de TanStack Start, pero no tiene autenticación, base de datos, almacenamiento, realtime ni backend de negocio. Todos los datos académicos son mocks en TypeScript o estado local y se pierden al recargar.

La arquitectura objetivo y el plan por fases están en [ARCHITECTURE.md](./ARCHITECTURE.md).

## 1. Estado general

| Área | Estado actual | Diagnóstico |
| --- | --- | --- |
| Frontend | Implementado como prototipo | React 19, TypeScript, TanStack Start/Router, Tailwind CSS 4 y Vite 8. |
| Routing | Implementado | Enrutamiento file-based con layouts por rol. |
| Estado local | Implementado | Uso extensivo de `useState`; suficiente para la demo, no para persistencia. |
| Estado remoto | Preparado, pero sin uso | Existe `QueryClient`, pero no hay `useQuery`, `useMutation` ni llamadas de negocio. |
| Backend de negocio | No existe | Solo hay runtime SSR, middleware de errores/CSRF y una server function que lee una cookie. |
| Base de datos | No existe | No hay SDK, esquema, migraciones, SQL ni variables de entorno de un proveedor. |
| Autenticación | No existe | Login y registro son formularios visuales sin envío. Las rutas no están protegidas. |
| Multi-tenancy | No existe | No hay `colegio_id`, membresías, RLS ni separación de datos. |
| Storage | No existe | Los uploaders son únicamente maquetas visuales. |
| Realtime/chat | No existe | Chat con datos literales y formulario inerte. |
| Tests/CI | No existen | No hay runner de tests, pruebas ni workflow de CI. |
| Docker | No existe | No hay backend Python ni archivos Docker. |

## 2. Stack frontend actual

### 2.1 Framework y build

Versiones declaradas en `package.json`:

- React `^19.2.0` y React DOM `^19.2.0`: `package.json:54-56`.
- TypeScript `^5.8.3`, con `strict: true`: `package.json:83`, `tsconfig.json:18`.
- TanStack Start `^1.168.32`: `package.json:45`.
- TanStack Router `^1.170.18`: `package.json:44`.
- TanStack Query `^5.101.1`: `package.json:43`.
- Vite `^8.1.5`: `package.json:85`.
- Tailwind CSS y plugin Vite `^4.2.1`: `package.json:42`, `package.json:62`.
- Nitro beta como runtime de servidor: `package.json:81`.
- Configuración nativa de Vite + TanStack Start (sin preset externo): `frontend/vite.config.ts`.
- npm como gestor: `frontend/package.json`, `frontend/package-lock.json`.

La configuración nativa de Vite declara explícitamente los plugins (`tanstackStart`, `viteReact`, `tailwindcss`, `nitro` con preset `cloudflare-module`, `devtools` solo en dev) y el alias `@`. El proyecto añade un entry SSR propio para normalizar errores: `frontend/vite.config.ts:34-37`, `frontend/src/server.ts:12-59`.

### 2.2 Routing

- Routing file-based en `frontend/src/routes/` y árbol generado en `frontend/src/routeTree.gen.ts`.
- Router creado con `createRouter`, restauración de scroll y contexto de TanStack Query: `frontend/src/router.tsx:5-13`.
- Layout raíz con `QueryClientProvider`, error boundary y 404: `frontend/src/routes/__root.tsx:75-136`.
- Layouts separados por rol:
  - `frontend/src/routes/super.tsx`
  - `frontend/src/routes/admin.tsx`
  - `frontend/src/routes/docente.tsx`
  - `frontend/src/routes/estudiante.tsx`
  - `frontend/src/routes/perfil.tsx`
- La navegación por rol está centralizada en `frontend/src/components/app-shell.tsx:34-85`.
- Solo las rutas ICFES tienen un guard, y este se basa en un plan manipulable mediante cookie: `frontend/src/lib/icfes-guard.ts:8-14`.

Problemas de routing/autorización:

- Cualquier visitante puede navegar directamente a `/super`, `/admin`, `/docente` o `/estudiante`; no hay sesión ni guard de rol.
- `/perfil` siempre usa `role="admin"`, incluso para docentes, estudiantes o super admins: `frontend/src/routes/perfil.tsx:4-6`.
- El estado activo del menú compara la URL de forma exacta, por lo que no cubre subrutas: `frontend/src/components/app-shell.tsx:112-119`.
- `frontend/src/routeTree.gen.ts` es generado y no debe editarse manualmente.

### 2.3 Gestión de estado

Estado local:

- Los flujos usan principalmente `useState`: wizard de registro, pestañas, formularios ICFES, examen, filtros, chat y menús.
- El banco de preguntas y los simulacros se modifican solo en memoria: `frontend/src/components/icfes/question-bank.tsx:42`, `frontend/src/components/icfes/simulacro-builder.tsx:18-71`.
- Las respuestas y el temporizador ICFES viven dentro del componente: `frontend/src/components/icfes/exam.tsx:35-53`.

Estado compartido:

- El plan del colegio usa una implementación propia con cookie, evento del navegador y `useSyncExternalStore`: `frontend/src/lib/plan.ts:20-37`, `frontend/src/hooks/use-plan.ts`.
- El usuario puede cambiar su propio plan desde el header: `frontend/src/components/app-shell.tsx:208-220`.

Estado remoto:

- Se crea un `QueryClient` y se expone mediante provider: `frontend/src/router.tsx:5-13`, `frontend/src/routes/__root.tsx:128-136`.
- No hay llamadas `useQuery`, `useMutation`, `fetch`, Axios ni otra capa de acceso a datos de negocio.
- Por tanto, TanStack Query está instalado y configurado, pero actualmente no aporta funcionalidad.

### 2.4 UI y estilos

- Tailwind CSS 4 y tokens de diseño en `frontend/src/styles.css`.
- Componentes propios reutilizados por las rutas:
  - `PageHeader`, `SectionCard`, `StatCard`, `EmptyHint`: `frontend/src/components/ui-kit.tsx`.
  - `StatusBadge`: `frontend/src/components/status-badge.tsx`.
  - `AppShell`: `frontend/src/components/app-shell.tsx`.
- Primitivas shadcn/Radix en `frontend/src/components/ui/`.
- Las rutas y componentes de dominio no importan actualmente las primitivas `frontend/src/components/ui/*`; solo se importan entre ellas. Hay una cantidad considerable de código y dependencias generadas que todavía no se usan.
- Recharts sí se usa en dashboards y resultados agregados ICFES.

## 3. Backend, persistencia y proveedores actuales

### 3.1 Backend

No existe un backend de negocio.

Sí existe una capa de servidor asociada al frontend:

- `frontend/src/server.ts` envuelve el entry SSR de TanStack Start y normaliza respuestas 500: `frontend/src/server.ts:12-59`.
- `frontend/src/start.ts` instala middleware de error y CSRF para server functions: `frontend/src/start.ts:5-29`.
- Solo existe una server function de aplicación: `getIcfesAccess`, que lee una cookie y calcula un booleano: `frontend/src/lib/icfes.functions.ts:11-14`.

Esta capa no contiene CRUD, repositorios, integraciones, colas, jobs ni acceso a base de datos. No debe confundirse con el backend FastAPI objetivo.

### 3.2 Base de datos y autenticación

No hay proveedor configurado actualmente:

- No está instalado `@supabase/supabase-js` ni otro SDK de base de datos/auth: `package.json:14-66`.
- No existe directorio `supabase/`, migraciones SQL, ORM ni esquema.
- No hay `.env` o `.env.example`.
- No existen llamadas a Supabase, Firebase, Prisma, Drizzle, Postgres u otro proveedor.
- No hay integración con servicios externos de build/editor: `frontend/vite.config.ts` usa solo plugins de Vite, TanStack, Tailwind y Nitro.

Autenticación actual:

- El login solo ejecuta `preventDefault`: `frontend/src/routes/login.tsx:54-83`.
- Los enlaces de demo navegan directamente a cualquier rol: `frontend/src/routes/login.tsx:85-100`.
- El registro no crea colegio ni usuario; el botón final es un link directo a `/admin`: `frontend/src/routes/registro.tsx:140-162`.
- El nombre y rol del usuario están hardcodeados: `frontend/src/components/app-shell.tsx:80-85`.

### 3.3 CRUD y datos

No hay CRUD real. Los datos se leen de constantes:

- Datos académicos, colegios, planes y métricas: `frontend/src/lib/edu-data.ts:3-133`.
- Preguntas, simulacros, intentos y resultados ICFES: `frontend/src/lib/icfes-data.ts:19-334`.
- Varias rutas mantienen datos literales dentro del propio componente, por ejemplo `frontend/src/routes/docente.materia.tsx:20-34`.

Las acciones visibles no persisten:

- Alta/carga de docentes y estudiantes: `frontend/src/routes/admin.docentes.tsx:22-35`, `frontend/src/routes/admin.estudiantes.tsx:22-35`.
- Contenido, entregas, evaluaciones y calificaciones: `frontend/src/routes/docente.materia.tsx:66-214`.
- Entrega de tareas: `frontend/src/routes/estudiante.tareas.tsx:41-75`.
- Chat: `frontend/src/components/chat-panel.tsx:10-14`, `frontend/src/components/chat-panel.tsx:65-79`.

### 3.4 Multi-tenancy y plan

No hay aislamiento multi-tenant real:

- No existe `colegio_id`, tabla de membresías ni políticas RLS.
- El colegio actual es una constante global: `frontend/src/lib/edu-data.ts:3-8`.
- El plan se guarda en la cookie `edu_plan`, sin firma y escribible desde JavaScript: `frontend/src/lib/plan.ts:3-4`, `frontend/src/lib/plan.ts:27-31`.
- El guard ICFES confía en esa cookie: `frontend/src/lib/icfes.functions.ts:11-14`.

Impacto: cualquier usuario puede seleccionar `Premium` desde el header o modificar la cookie y habilitar ICFES. La afirmación de que el plan se valida “en el servidor” no proporciona seguridad porque la fuente que lee el servidor la controla el cliente.

## 4. Inventario funcional actual

| Módulo | Estado | Implementación actual |
| --- | --- | --- |
| Usuarios | Mock | Listas estáticas de docentes, estudiantes y administradores; sin altas reales. |
| Cursos y materias | Mock | Cards y asignaciones con arrays locales. |
| Contenido | Mock | Lista y dropzone visual dentro de `docente.materia`. |
| Tareas | Mock | Listas y archivos hardcodeados; sin storage. |
| Evaluaciones | Mock | Constructor visual y examen estático no persistente. |
| Calificaciones | Mock | Inputs con `defaultValue`; no recalculan ni guardan. |
| Simulacros ICFES | Demo funcional en cliente | Banco, builder, timer y scoring funcionan en memoria; resultados agregados son mocks. |
| Chat | Mock | Conversaciones y mensajes literales; sin realtime. |
| Suscripciones | Mock | Planes y campos de tarjeta visuales; no hay pasarela ni webhooks. |
| Reportes | Parcial | Abre una ventana y usa el diálogo de impresión del navegador. |

El módulo ICFES es el más desarrollado desde el punto de vista de interacción, pero no es confiable para producción porque las respuestas correctas y la calificación están en el cliente: `frontend/src/components/icfes/exam.tsx:199-212`.

## 5. Reutilización del código

### 5.1 Reutilizable prácticamente tal cual

| Código | Motivo |
| --- | --- |
| `frontend/src/styles.css` | Tokens, paleta y utilidades Tailwind ya forman un design system coherente. |
| `frontend/src/lib/utils.ts` | Helper `cn` estándar y desacoplado. |
| `frontend/src/components/ui-kit.tsx` | Componentes presentacionales pequeños y ampliamente usados. |
| `frontend/src/components/status-badge.tsx` | API presentacional sencilla y reusable. |
| `frontend/src/hooks/use-mobile.tsx` | Hook aislado y sin dependencia del modelo mock. |
| `frontend/src/router.tsx` y convención `frontend/src/routes/` | El routing existente puede conservarse; no se justifica migrar de framework. |
| Partes visuales de dashboards, tablas y formularios | El markup y los estilos pueden mantenerse mientras se sustituyen sus fuentes de datos. |

### 5.2 Reutilizable con ajuste menor o moderado

| Código | Ajuste requerido |
| --- | --- |
| `frontend/src/components/app-shell.tsx` | Sustituir roles, usuario, colegio y plan hardcodeados por sesión/queries reales; eliminar selector de plan en producción. |
| Layouts `admin.tsx`, `docente.tsx`, `estudiante.tsx`, `super.tsx` | Añadir guards reales de sesión, membresía y rol. |
| `frontend/src/routes/login.tsx` | Conservar UI, conectar Supabase Auth, validación y manejo de errores. |
| `frontend/src/routes/registro.tsx` | Conservar wizard visual, pero rediseñar alta transaccional y pago; no manejar tarjetas crudas. |
| Rutas CRUD de admin | Conservar tablas/cards; incorporar queries, formularios validados, paginación y estados remotos. |
| `frontend/src/components/chat-panel.tsx` | Conservar layout; sustituir mensajes y conversaciones por Supabase y controlar el formulario. |
| `frontend/src/components/icfes/aggregate-results.tsx` | Conservar filtros, cards, tabla y gráfico; recibir agregados calculados por FastAPI. |
| `frontend/src/components/icfes/exam.tsx` | Conservar el runner visual, navegación y timer como UX; eliminar claves y scoring del cliente. |
| `frontend/src/server.ts`, `frontend/src/start.ts` | Se pueden mantener para SSR/errores/CSRF del frontend, pero no deben alojar la lógica que corresponde a FastAPI. |
| Primitivas `frontend/src/components/ui/*` | Conservar solo las que el refactor use; eliminar el resto al final, no antes. |

### 5.3 Reescritura completa o sustitución

| Código | Razón |
| --- | --- |
| `frontend/src/lib/edu-data.ts` | Es la “base de datos” mock. Debe sustituirse gradualmente por queries tipadas a Supabase/API. |
| Datos runtime de `frontend/src/lib/icfes-data.ts` | Los tipos/constantes de catálogo pueden sobrevivir; preguntas, simulacros, intentos y resultados deben salir del bundle. |
| `frontend/src/lib/plan.ts` y `frontend/src/hooks/use-plan.ts` | El plan no puede ser una cookie editable; debe provenir de suscripción/entitlements autoritativos. |
| `frontend/src/lib/icfes.functions.ts` y `frontend/src/lib/icfes-guard.ts` | El guard debe resolver sesión, colegio y entitlement real, y el backend debe repetir la validación. |
| Scoring en `frontend/src/components/icfes/exam.tsx` | Debe convertirse en funciones puras probadas dentro de FastAPI y ejecutarse con datos protegidos. |
| CRUD en `question-bank.tsx` y `simulacro-builder.tsx` | Debe desacoplarse de la UI y persistirse con RLS; las reglas sensibles pasan al backend. |
| `frontend/src/lib/pdf-export.ts` | Usa `document.write` con `innerHTML` y solo abre impresión; debe sustituirse por generación PDF server-side. |
| `ExamView` de `frontend/src/routes/estudiante.evaluaciones.tsx` | Es una pantalla fija, no un flujo de evaluación real. |

## 6. Deuda técnica e inconsistencias

### 6.1 Crítica/alta

1. **Sin autenticación ni autorización:** cualquier rol y ruta están abiertos.
2. **Sin aislamiento multi-tenant:** no existe `colegio_id` ni RLS.
3. **Plan falsificable:** cookie editable usada como autorización: `frontend/src/lib/plan.ts:27-31`.
4. **Scoring ICFES manipulable:** claves y cálculo están en el navegador: `frontend/src/components/icfes/exam.tsx:199-212`.
5. **Sin persistencia:** todo el supuesto CRUD se pierde al recargar.
6. **Formulario de pago engañoso y riesgoso:** la UI solicita número de tarjeta/CVC aunque no existe proveedor ni tokenización: `frontend/src/routes/registro.tsx:128-133`. En producción debe usarse checkout alojado o componentes seguros del proveedor; la aplicación no debe recibir ni almacenar datos crudos de tarjeta.
7. **PDF con HTML crudo:** `document.write` inserta `title` e `innerHTML`: `frontend/src/lib/pdf-export.ts:14-24`.
8. **No hay tests de RLS, negocio o UI y no existe CI.**

### 6.2 Media

- Lógica de dominio mezclada con UI, especialmente ICFES: `frontend/src/components/icfes/exam.tsx`, `question-bank.tsx`, `simulacro-builder.tsx`, `aggregate-results.tsx`.
- `docente.materia.tsx` concentra contenido, tareas, evaluaciones, estudiantes y calificaciones en un archivo: `frontend/src/routes/docente.materia.tsx:20-214`.
- Zod, React Hook Form y sus resolvers están instalados, pero los flujos no validan datos en runtime: `package.json:15`, `package.json:57`, `package.json:66`.
- No existen estados remotos consistentes de loading, error, retry o feedback de éxito.
- `QueryClient` configurado sin queries reales: `frontend/src/router.tsx:5-13`.
- `tsconfig.json` es estricto, pero permite locales/parámetros no usados: `tsconfig.json:18-20`.
- El `.gitignore` no contiene una regla genérica para `.env`/secretos: `.gitignore:1-32`.
- El error boundary y 404 están en inglés mientras la aplicación está en español: `frontend/src/routes/__root.tsx:15-73`.
- `<html lang="en">` contradice el idioma de la aplicación: `frontend/src/routes/__root.tsx:114-124`.
- No hay headers de seguridad explícitos como CSP o políticas de framing.

### 6.3 Bugs/inconsistencias concretas

- El filtro por grado del builder nunca filtra debido a `q.grado === grado || true`: `frontend/src/components/icfes/simulacro-builder.tsx:33-36`.
- `ChatPanel` falla con un arreglo de conversaciones vacío: `frontend/src/components/chat-panel.tsx:7-12`.
- `/perfil` fuerza el rol admin: `frontend/src/routes/perfil.tsx:4-6`.
- Inputs de calificaciones no están controlados y el promedio mostrado no se deriva de sus valores: `frontend/src/routes/docente.calificaciones.tsx:49-60`.
- La navegación marca activa solo una coincidencia exacta: `frontend/src/components/app-shell.tsx:112-119`.
- El nombre interno del paquete es `tanstack_start_ts`, el README dice “Lumen” y la interfaz dice “Lumen”: `package.json:2`, `README.md:1-5`, `frontend/src/routes/__root.tsx:80`.
- La aplicación objetivo es para Colombia, pero varios textos/datos son argentinos: voseo, “Matemática”, teléfono `+54`, referencia a Córdoba y escalas de notas 0–10: `frontend/src/routes/registro.tsx:81-103`, `frontend/src/lib/edu-data.ts:37-75`. ICFES sí corresponde a Colombia. La localización académica debe normalizarse antes de producción.
- Datos visuales inconsistentes: la cabecera muestra 96 docentes y 1.284 estudiantes, pero las listas contienen cinco elementos: `frontend/src/routes/admin.docentes.tsx:22-24`, `frontend/src/routes/admin.estudiantes.tsx:22-24`, `frontend/src/lib/edu-data.ts:37-51`.
- Los planes comerciales no incluyen `Free`, pero el selector interno sí: `frontend/src/lib/edu-data.ts:77-116`, `frontend/src/components/app-shell.tsx:208-219`.

## 7. Evaluación final

No se recomienda reescribir el frontend. La ruta de menor riesgo es conservar React, TanStack Start/Router, Tailwind y la mayor parte de la UI, e ir reemplazando los mocks por módulos tipados.

La prioridad no debe ser añadir más pantallas, sino establecer primero:

1. esquema multi-tenant y RLS verificable;
2. autenticación y membresías reales;
3. una frontera explícita entre acceso directo a Supabase y operaciones FastAPI;
4. pruebas automatizadas, especialmente de aislamiento entre colegios;
5. eliminación de fuentes de autorización controladas por el cliente.

Hasta completar esas bases, el repositorio debe tratarse como prototipo y no como aplicación segura para datos académicos reales.

---

## Nota de estado (2026-11-22)

Este documento es **histórico**: describe el repositorio antes de Supabase y
antes del backend FastAPI, y no se actualiza a medida que el proyecto avanza.
No lo tomes como el estado actual del código.

El estado actual está en [ARCHITECTURE.md](./ARCHITECTURE.md) y en el
[README](./README.md). Desde entonces el proyecto tiene backend propio
(autenticación, permisos, endpoints y archivos en su propio disco) y ya no
depende de Supabase ni de Wompi.
