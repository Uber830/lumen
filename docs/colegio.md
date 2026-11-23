# El rol de administrador de colegio

Guía del panel que administra un colegio: qué puede hacer el rol, cómo está
construido y qué decisiones del producto ya están tomadas.

---

## 1. El modelo del producto, en una línea

> El colegio entrega su información; el **equipo de plataforma** carga el material
> al catálogo editorial y decide qué colegio puede ver cada pieza; el colegio
> solo consume.

De ahí sale la regla que atraviesa todo el panel:

| Acción | Plataforma | Admin de colegio |
| --- | --- | --- |
| Cargar material al catálogo | Sí | **No** |
| Definir qué colegios ven cada material | Sí | **No** |
| Publicar, archivar o despublicar | Sí | **No** |
| Ver el material habilitado para su colegio | Sí | Sí |
| Administrar docentes, estudiantes y cursos | Sí | **Sí** |
| Administrar administradores del colegio | Sí | **Sí** |
| Cambiar la identidad del colegio | Sí | **Sí** |

En la vista **Contenido** no hay botón de subir, ni de publicar, ni de editar
metadatos: el administrador consulta el material habilitado y nada más.

---

## 2. Las vistas

| Vista | Ruta | Qué hace |
| --- | --- | --- |
| Dashboard | `/admin` | KPIs del colegio, material por área, estado del colegio, actividad reciente y acciones rápidas |
| Contenido | `/admin/contenido` | Material habilitado, **solo lectura**; 6 filas por página y filtro en el servidor |
| Docentes | `/admin/docentes` | Alta, edición, filtro por estado y por curso, y la señal de **Acceso** |
| Estudiantes | `/admin/estudiantes` | Alta, matrícula, filtro por curso, promedio y estado |
| Cursos y materias | `/admin/cursos` | Dos paneles: los cursos del colegio y las materias con sus cursos |
| Asignaciones | `/admin/asignaciones` | Docente ↔ curso ↔ materia, con el **material visible** calculado, e importación del plan de estudios |
| Períodos | `/admin/periodos` | Ciclo lectivo, modalidad, cierre de periodo y periodo vigente |
| ICFES | `/admin/icfes-colegio` | Simulacros que la plataforma habilitó, activados por curso, con sus resultados |
| Personalización | `/admin/personalizacion` | Nombre visible, escudo y color primario (contraste validado en el backend) |
| Administradores | `/admin/administradores` | El equipo del colegio, con rango Principal o Secundario |
| Soporte | `/admin/soporte` | Solicitudes al equipo de Lumen, con adjuntos, y el hilo de respuesta |

«Mi perfil» vive en el **menú de usuario** (arriba a la derecha), no en el menú
lateral.

### La selección múltiple

Las listas de **docentes**, **estudiantes** y **administradores** aceptan la
selección de varias filas. La barra que aparece arriba dice cuántos están
seleccionados y ofrece lo que se puede hacer con ellos:

| Lista | Acciones de la barra |
| --- | --- |
| Docentes y estudiantes | Activar acceso · Desactivar acceso |
| Administradores | Cambiar a secundario |

Quitar el acceso es revocar la membresía: la persona deja de llegar al
material del colegio y su historial se conserva. El backend sigue negándose a
degradar o quitar al último administrador principal (`409`, `last_principal`).

### El plan de estudios

**Asignaciones → Importar desde plan de estudios** crea de una vez los cursos
de un grado con sus materias ofrecidas. La importación es **idempotente**: un
curso que ya existe se omite y las materias del colegio se reutilizan en vez
de duplicarse.

Los planes que la plataforma ofrece (sexto a décimo) viven en
`backend/app/academics/study_plan.py`; el endpoint dice cuáles ya existen y
cuántos estudiantes hay en cada uno.

---

## 3. Los dos rangos

| Capacidad | Principal | Secundario |
| --- | --- | --- |
| Ver dashboard, contenido, docentes, estudiantes, cursos, asignaciones, períodos, ICFES | Sí | Sí |
| Crear y editar docentes, estudiantes, cursos, materias, asignaciones | Sí | Sí |
| Cerrar y marcar períodos | Sí | **No** |
| Invitar y quitar administradores | Sí | **No** |
| Cambiar identidad y color primario | Sí | **No** |

El frontend **no decide** permisos: los recibe en `GET /v1/school/me`
(`permissions: string[]`). Una acción que el rango no puede ejecutar aparece
**deshabilitada con el motivo**, no invisible.

El colegio siempre conserva **un principal**: el equipo no puede degradar ni
quitar al último (`409`, `last_principal`).

---

## 4. La API del panel

Prefijo `/v1/school`. El `school_id` **se deduce siempre del token**: el cliente
nunca lo envía. Un recurso de otro colegio responde **404**, no 403: no se
revela la existencia de material ajeno.

| Endpoint | Devuelve |
| --- | --- |
| `GET /v1/school/me` | Perfil, colegio, rango, `permissions` y periodo vigente |
| `GET /v1/school/overview` | El dashboard entero en una llamada |
| `GET /v1/school/material?q=&area=&page=` | Material habilitado (6 por página) |
| `GET /v1/school/material/{id}` | Detalle de un material habilitado |
| `GET /v1/school/teachers|students|courses|subjects|assignments|periods` | La comunidad y el ciclo |
| `PATCH /v1/school/members/{id}` | Editar a un docente o a un estudiante: nombre, correo y cursos o materias |
| `GET /v1/academics/study-plans` · `POST /study-plans/import` | El plan de estudios del colegio y su importación |
| `GET /v1/school/settings` · `PATCH` | Identidad del colegio (el color se valida en el backend) |
| `POST /v1/school/logo` | Escudo: PNG o SVG, máximo 2 MB, tipo real |
| `GET /v1/school/admins` · `POST /admins/invite` · `PATCH|DELETE /admins/{id}` | El equipo del colegio |
| `GET /v1/school/icfes` · `POST /icfes/{id}/activations` · `GET /icfes/{id}/results` | Simulacros del colegio |
| `GET/POST /v1/school/support/cases` · `GET /cases/{id}` · `POST /cases/{id}/messages` | Canal con el soporte |
| `POST /v1/school/support/attachments` | El archivo que se adjunta a una solicitud (10 MB) |

La API responde en inglés; el frontend traduce los mensajes de error.

---

## 5. ICFES: tres capas, un solo dueño

| Capa | Tabla | Quién escribe |
| --- | --- | --- |
| El catálogo de simulacros | `icfes_simulators` | El equipo de plataforma |
| Quién tiene cada simulacro | `icfes_simulator_schools` | El equipo de plataforma |
| Qué hace el colegio con lo que recibió | `icfes_activations` | El colegio (curso por curso) |

Reglas:

- el colegio solo ve lo que la plataforma le habilitó;
- un simulacro en borrador nunca llega al colegio;
- activar es elegir **varios cursos** y la **fecha límite** de cada uno;
- el puntaje promedio sale de los intentos de los estudiantes de los cursos
  activados, sobre la escala de 0 a 500 del módulo ICFES.

El simulacro apunta al examen que el estudiante presenta
(`icfes_simulators.simulation_id`), así que el resultado del panel es el de
una corrida real.

---

## 6. Soporte: quién responde qué

- El **colegio** abre la solicitud y responde en el hilo.
- El **equipo de Lumen** responde y resuelve.
- El colegio **no marca el caso como resuelto**: no hay endpoint ni botón.
- El estudiante no tiene ruta a este canal.
- Un mensaje puede llevar **adjuntos** (PDF, imagen o documento, hasta 10 MB):
  el archivo va al almacén del colegio y el hilo guarda su ruta.

---

## 7. Las decisiones ya tomadas

| Decisión | Lo que se hizo |
| --- | --- |
| ¿El admin descarga el material? | **No.** La interfaz no lo ofrece (§15 del prompt) |
| ¿Alguien descarga material? | **No.** La descarga se quitó de todo el producto: el permiso `material.download` ya no existe en la API y el panel del estudiante no ofrece el botón. El material se consulta dentro de la plataforma; el enlace externo «Abrir» se conserva porque no es una descarga de material |
| ¿Quién manda en el catálogo editorial? | El diseño de este proyecto (`ref`, `kind`, `state`, el archivo dentro de la pieza) es el canónico. La otra rama se adapta a estos nombres; la migración trae un catálogo que llegó con otra forma a esta, sin dejar dos columnas con el mismo valor |
| ¿Y la mesa de soporte? | También manda este proyecto: el caso tiene `title`, `category` y `opened_at`. La migración traduce la forma de la otra rama (`subject`, `detail`, estados en inglés) y deja la descripción como el primer mensaje del hilo |
| ¿Misión, visión, portada y galería? | **Eliminadas** de Personalización, con migración que borra la columna y su contenido |
| ¿El cierre de periodo archiva el material? | **Sí**: `material_schools.archived_at` marca la pieza como archivada *para ese colegio*; la fila queda en el histórico |
| ¿Multi-sede? | **No** se construye en este milestone |
| ¿El color primario? | Se valida en el backend contra `--bg` y `--surface` (WCAG 2.1): por debajo de 4.5:1 se rechaza con 422 y el ratio en el mensaje |
| ¿LasIcFES? | El catálogo de simulacros es de la plataforma; el colegio solo activa |

---

## 8. Cómo levantarlo en local

```bash
# Base de datos con las migraciones y la semilla del colegio de demostración
./scripts/dev-db.sh reset

# API
cd backend && uv run lumen-api        # http://localhost:8010

# Frontend
cd frontend && npm ci && npm run dev  # http://localhost:5174
```

Cuenta de demostración del colegio:

| Correo | Contraseña | Rol |
| --- | --- | --- |
| `ana.restrepo@sagcor.edu.co` | `lumen-dev` | Administradora principal del colegio de demostración |

La semilla deja el colegio con 12 docentes, 184 estudiantes, 5 cursos, 5
materias, 3 períodos, 16 materiales en el catálogo (7 habilitados), 4
simulacros de ICFES y 3 solicitudes de soporte.

---

## 9. Comandos de verificación

```bash
# Backend (la base de pruebas se crea antes: la suite necesita una base limpia)
cd backend && uv run ruff format . && uv run ruff check . && uv run mypy app
uv run pytest

# Frontend
cd frontend && npm run typecheck && npm run lint && npm run test && npm run build

# Prueba de extremo a extremo del panel (necesita el navegador de Playwright)
npx playwright install --with-deps chromium
npm run test:e2e
```

El e2e del panel (`tests/e2e/colegio.spec.ts`) recorre la cadena del
producto: entrar como administrador, ver el contenido habilitado del colegio,
crear un docente, asignarlo a un curso y comprobar que la asignación dice
cuánto material ve el docente, activar un simulacro y abrir una solicitud de
soporte.

> En una máquina sin las librerías del sistema del navegador, Playwright no
> arranca. El comando `npx playwright install --with-deps` las instala, y
> necesita permisos de administrador del sistema.
