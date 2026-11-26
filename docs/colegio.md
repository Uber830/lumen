# El rol de administrador de colegio

Guía del panel que administra un colegio: qué puede hacer el rol, cómo está
construido y qué decisiones del producto ya están tomadas.

---

## 1. El modelo del producto, en una línea

> El colegio entrega su información; el **equipo de plataforma** carga el material
> al catálogo editorial y decide qué colegio puede ver cada pieza; el colegio
> consume ese material y, además, carga el suyo propio, deciding a quién va
> dirigido.

De ahí sale la regla que atraviesa todo el panel:

| Acción | Plataforma | Admin de colegio |
| --- | --- | --- |
| Cargar material al catálogo editorial | Sí | **No** |
| Cargar material propio del colegio | Sí | **Sí** |
| Definir qué colegios ven cada material del catálogo | Sí | **No** |
| Decidir a quién va dirigido cada material propio | **No** | **Sí** |
| Publicar, archivar o despublicar el material editorial | Sí | **No** |
| Ver el material habilitado para su colegio | Sí | Sí |
| Administrar docentes, estudiantes y cursos | Sí | **Sí** |
| Administrar administradores del colegio | Sí | **Sí** |
| Cambiar la identidad del colegio | Sí | **Sí** |

En la vista **Biblioteca** el administrador consulta el material habilitado y
también carga el propio: el botón **Cargar recurso** abre un formulario, y la
tarjeta del recurso queda marcada con **Cargado por el colegio**. Lo que el
colegio carga no entra al catálogo editorial — eso es de la plataforma — pero
nace publicado y habilitado para su colegio, y el colegio puede quitarlo
cuando quiera.

---

## 2. Las vistas

| Vista | Ruta | Qué hace |
| --- | --- | --- |
| Dashboard | `/admin` | KPIs del colegio, material por área, estado del colegio, actividad reciente y acciones rápidas |
| Biblioteca | `/admin/contenido` | Los recursos habilitados y los propios del colegio, como una estantería: cada recurso es una tarjeta con su portada y se abre en un modal sobre la vista, donde **se ve el archivo**. El botón **Cargar recurso** sube material propio |
| Docentes | `/admin/docentes` | Alta, edición, filtro por estado y por curso, y la señal de **Acceso**. La ficha de **Gestionar** muestra los datos de la persona y su acceso: sus materias se cambian en Asignaciones, y **Editar** solo cambia el nombre y el correo |
| Estudiantes | `/admin/estudiantes` | Alta, matrícula (un estudiante es de **un** curso), filtro por curso, promedio y estado |
| Cursos y materias | `/admin/cursos` | Los cursos del colegio a lo ancho de la vista; al hacer clic en **Materias** se abre un **modal** con las de ese curso (la tabla no se mueve). La estructura se arma en **un formulario por pasos** (curso → materia → ofrecer) |
| Asignaciones | `/admin/asignaciones` | Docente ↔ curso ↔ materia, **agrupadas por docente**: una fila por persona, con la primera materia y el contador **+N**; el contador abre un modal con todas, para editarlas o quitarlas |
| Períodos | `/admin/periodos` | Ciclo lectivo, cierre de periodo y periodo vigente |
| ICFES | `/admin/icfes-colegio` | Los simulacros del colegio: el módulo se está afinando y el panel lo avisa |
| Personalización | `/admin/personalizacion` | Nombre visible, escudo y color primario (contraste validado en el backend) |
| Administradores | `/admin/administradores` | El equipo del colegio, con rango Principal o Secundario |
| Soporte | `/admin/soporte` | Solicitudes al equipo de Lumen, con adjuntos, y el hilo de respuesta. La lista se corta en páginas de 10, como la de Asignaciones |

«Mi perfil» vive en el **menú de usuario** (arriba a la derecha), no en el menú
lateral.

### Los formularios van en un modal

Todos los formularios del panel (invitar administrador, nuevo periodo, nueva
asignación, enviar solicitud, la ficha del administrador) se abren en un
**modal centrado**, con el estilo del panel: esquinas de 4 px, Space Grotesk y
los colores del colegio. La lista de detrás no se mueve, y el control que no
puede ejecutarse aparece **deshabilitado con el motivo**.

### La barra lateral se contrae

El botón de la barra superior pliega la barra lateral a una franja de iconos
(68 px) y la vuelve a desplegar (270 px). La preferencia es personal y vive
en el navegador (`localStorage`, `lumen-sidebar-collapsed`), así que es la
misma en todos los paneles: colegio, docente, estudiante y plataforma.

El valor se lee **al montar el componente**, no durante el render: el servidor
siempre envía la barra desplegada y React no parchea los atributos que no
coinciden con los del cliente.

### La vista de cursos y las materias dentro

La tabla de cursos ocupa el ancho completo: el panel de materias que estaba
al lado se fue. Cada fila tiene un botón **Materias** que abre un **modal**
con las materias de ese curso, con el área, los docentes que la imparten y
la ✕ para **quitarla del curso**. El modal no mueve la tabla: los cursos
siguen donde estaban.

Las materias que **no están en ningún curso** se listan aparte: si no, no se
verían en ninguna parte y no se podrían quitar. Allí sí está **Quitar la
materia**, porque es el único sitio donde no tiene asignaciones. Los cursos
también se quitan (con confirmación: el curso se borra con sus materias
ofrecidas y con las asignaciones de los docentes que las impartían; el
material ya subido se conserva).

### Las listas largas se paginan

Los cursos, las materias y las asignaciones se cortan en páginas de **10**,
con el mismo pie que usan las otras listas del panel («Mostrando 1–10 de 24»
y los números de página). El corte lo hace **el servidor**, como el de los
docentes y los estudiantes:

| Endpoint | Qué devuelve |
| --- | --- |
| `GET /v1/school/courses` | Una página de cursos |
| `GET /v1/school/courses/options` | Todos los cursos, para los formularios |
| `GET /v1/school/subjects` | Una página de materias (`?offered=false` para las que no están en ningún curso) |
| `GET /v1/school/subjects/options` | Todas las materias, para los formularios |
| `GET /v1/school/assignments` | Una página de docentes, cada uno con sus materias |

La fila de las asignaciones es el docente, y el servidor la agrupa: la
persona no se repite.

### La biblioteca, como una estantería

**Contenido** pasó a llamarse **Biblioteca** (`/admin/contenido`) y el
**Catálogo editorial** de la plataforma, **Biblioteca de recursos**
(`/super/catalogo`). Las rutas no cambian; lo que cambia es la vista: los
recursos ya no son filas de una tabla, son **tarjetas**.

Cada tarjeta lleva la **portada** con el color de su área (la misma área
tiene siempre el mismo color), el **tipo** del recurso (Libro, Guía,
Evaluación…), el nombre, la línea de abajo (área · cursos · tamaño) y las
**etiquetas** que dicen a quién va dirigido y de dónde salió.

Los filtros son los del diseño y corren en el servidor: la búsqueda, el
área, el destinatario (y en la plataforma, el tipo y el estado).

| Vista | Qué filtra |
| --- | --- |
| `GET /v1/school/material` | `q`, `area`, `audience` |
| `GET /v1/platform/catalog` | `q`, `type`, `status`, `visible_to` |

La acción depende del rol: el colegio **ve** el recurso (y quita los que él
mismo cargó); la plataforma lo **gestiona**.

### El colegio también carga recursos

El colegio tiene recursos propios: un manual de la escuela, una guía para
los docentes, un texto para los estudiantes. El botón **Cargar recurso**
abre un formulario con el archivo, el título, el tipo, el área y **a quién
va dirigido** — esa decisión es del colegio.

El recurso nace publicado y habilitado para su colegio, y su tarjeta lo
distingue con la etiqueta **Cargado por el colegio**. El colegio también
puede quitar los recursos que cargó (los del equipo de plataforma no son
suyos).

| Endpoint | Qué hace |
| --- | --- |
| `POST /v1/school/material/uploads` | Sube el archivo y devuelve su `file_id` |
| `POST /v1/school/material` | Crea el recurso y lo habilita para el colegio |
| `DELETE /v1/school/material/{id}` | Quita un recurso del colegio |
| `GET /v1/school/material/{id}/file` | Sirve el archivo, para verlo en la plataforma |

### El recurso se ve dentro de la plataforma

Al abrir un recurso, el archivo se muestra ahí mismo: una **imagen** como
imagen, un **PDF** en el lector del navegador, un **video** con sus
controles. Un formato que el navegador no puede pintar (un docx, un epub,
un zip) lo dice en vez de fingir. El archivo lo sirve la API con la sesión
del colegio: el material se consulta, no se descarga.

Las **audiencias** son cuatro: para todos, solo docentes, solo estudiantes
y solo administradores.

### La estructura académica, en un formulario

Crear un curso, una materia y ofrecerla ya no son tres cajas sueltas: la
vista **Cursos y materias** abre un modal grande y central con tres pasos
(**curso → materia → ofrecer**) y los botones **Siguiente** y **Atrás**. Un
paso en blanco se salta: el que solo necesita el curso avanza y cierra.

### Las asignaciones, agrupadas por docente

La lista tiene **una fila por docente**, no una por asignación: la persona es
lo que se repite, y lo que importa es lo que cada una enseña. La columna de
materias muestra **la primera** y el contador **+N** (el mismo patrón que usa
el panel en la ficha de un docente): el contador abre un modal **solo con la
lista**, sin acciones.

Las **acciones van juntas en la columna de acción** y son dos: *Asignar otra*
y *Quitar*. *Asignar otra* abre el formulario con **el docente de la fila
fijo**: solo se elige la materia, porque lo que se agrega es materia a ese
docente. *Quitar* abre el modal de las materias del docente con la ✕ de cada
una, para que el administrador elija cuál quita (pide confirmación antes).
No hay edición: una asignación se quita y se vuelve a hacer. El contador
**+N** abre el mismo modal, pero solo para leerlo. La barra de arriba dice los
dos números: docentes y asignaciones.

El **pie de paginación se ve siempre** en esta vista y en la de *Cursos y
materias*: aunque todo quepa en una página, el administrador ve el corte y los
números de lo que tiene.

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

### El equipo de administradores

El formulario de **invitar administrador** vive en un modal centrado, con el
mismo estilo que el resto de formularios del panel. El rango **no se elige**:
el colegio tiene un solo administrador principal, así que toda invitación entra
como **secundario**.

Para cambiar de manos el rango, la ficha del administrador tiene **Ceder el
rango principal**: la persona que lo recibe queda como principal y quien lo
cede sigue en el equipo como secundario. El backend lo hace en un solo paso
(`POST /v1/school/admins/{id}/transfer`), de modo que el colegio nunca se
queda sin principal; la promoción directa está rechazada con `409`
(`only_one_principal`).

Después de ceder el rango, la sesión se vuelve a leer: los permisos de quien
cede cambian en el panel (la acción queda deshabilitada con el motivo).

### La ficha del docente: solo el nombre y el correo

El formulario de **Editar** de un docente cambia **el nombre y el correo**, y
nada más. Las materias que imparte no se tocan ahí: se cambian en
**Asignaciones**, donde cada una es una fila con su propio **Asignar otra**
y su propio **Quitar**. El formulario no manda el campo de las asignaciones,
así que el backend las deja como estaban.

### El plan de estudios

La API sabe crear de una vez los cursos de un grado con sus materias
ofrecidas (`POST /v1/academics/study-plans/import`): la importación es
**idempotente**, un curso que ya existe se omite y las materias del colegio
se reutilizan en vez de duplicarse.

Los planes que la plataforma ofrece (sexto a décimo) viven en
`backend/app/academics/study_plan.py`; el endpoint dice cuáles ya existen y
cuántos estudiantes hay en cada uno. **El panel todavía no lo ofrece**: la
acción de importar quedó fuera del menú de asignaciones.

---

## 3. Los dos rangos

| Capacidad | Principal | Secundario |
| --- | --- | --- |
| Ver dashboard, biblioteca, docentes, estudiantes, cursos, asignaciones, períodos, ICFES | Sí | Sí |
| Crear y editar docentes, estudiantes, cursos, materias, asignaciones | Sí | Sí |
| Cerrar y marcar períodos | Sí | **No** |
| Invitar y quitar administradores | Sí | **No** |
| Cambiar identidad y color primario | Sí | **No** |

El frontend **no decide** permisos: los recibe en `GET /v1/school/me`
(`permissions: string[]`). Una acción que el rango no puede ejecutar aparece
**deshabilitada con el motivo**, no invisible.

El colegio tiene **un solo administrador principal**: el rango se cede de una
persona a otra, nunca se duplica. Por eso la invitación siempre crea un
secundario, la promoción directa se rechaza (`409`, `only_one_principal`) y el
equipo no puede degradar ni quitar al principal (`409`, `last_principal`).

---

## 4. La API del panel

Prefijo `/v1/school`. El `school_id` **se deduce siempre del token**: el cliente
nunca lo envía. Un recurso de otro colegio responde **404**, no 403: no se
revela la existencia de material ajeno.

| Endpoint | Devuelve |
| --- | --- |
| `GET /v1/school/me` | Perfil, colegio, rango, `permissions` y periodo vigente |
| `GET /v1/school/overview` | El dashboard entero en una llamada |
| `GET /v1/school/material?q=&area=&audience=&page=` | Material habilitado (6 por página) |
| `GET /v1/school/material/options` | Los catálogos cerrados del formulario: tipos, áreas y audiencias |
| `GET /v1/school/material/{id}` | Detalle de un material habilitado |
| `GET /v1/school/material/{id}/file` | El archivo del recurso, servido para verlo en la plataforma |
| `POST /v1/school/material/uploads` | Sube el archivo y devuelve su `file_id` |
| `POST /v1/school/material` | Crea el recurso propio y lo habilita para el colegio |
| `DELETE /v1/school/material/{id}` | Quita un recurso propio del colegio |
| `GET /v1/school/teachers|students|courses|subjects|assignments|periods` | La comunidad y el ciclo |
| `PATCH /v1/school/members/{id}` | Editar a un docente o a un estudiante: nombre, correo y cursos o materias |
| `GET /v1/academics/study-plans` · `POST /study-plans/import` | El plan de estudios del colegio y su importación |
| `GET /v1/school/settings` · `PATCH` | Identidad del colegio (el color se valida en el backend) |
| `POST /v1/school/logo` | Escudo: PNG o SVG, máximo 2 MB, tipo real |
| `GET /v1/school/admins` · `POST /admins/invite` · `PATCH|DELETE /admins/{id}` · `POST /admins/{id}/transfer` | El equipo del colegio |
| `GET /v1/school/icfes` · `POST /icfes/{id}/activations` · `GET /icfes/{id}/results` | Simulacros del colegio |
| `GET/POST /v1/school/support/cases` · `GET /cases/{id}` · `POST /cases/{id}/messages` | Canal con el soporte; la lista se corta en páginas de 10 |
| `GET /v1/school/support/open-count` | Los casos abiertos del colegio, para la campana |
| `POST /v1/school/support/attachments` | El archivo que se adjunta a una solicitud (10 MB) |

La API responde en inglés; el frontend traduce los mensajes de error.

### Los adjuntos, de los dos lados

El archivo que el colegio adjunta a una solicitud vive en el bucket
`support-attachments/{school_id}/` y el hilo guarda su ruta (`attachment_ids`).
El archivo **pertenece al colegio**: solo sus miembros lo leen.

La mesa de soporte de la plataforma es la excepción: el equipo que atiende la
solicitud necesita el mismo archivo, así que `GET /v1/platform/cases/{id}`
devuelve los `attachment_ids` de cada mensaje y el panel los muestra como
enlaces. La puerta de los archivos deja pasar al administrador de plataforma
(`context.is_platform_admin`) para cualquier colegio.

Los dos lados adjuntan: la plataforma sube el archivo con
`POST /v1/platform/cases/{id}/attachments` y lo manda en la respuesta
(`attachment_ids`). El archivo va al almacén del colegio del caso, así que
colegio y soporte leen la misma copia.

Cuando la plataforma responde **varios casos a la vez**, el archivo se copia
una vez por colegio: los casos del mismo colegio comparten la copia y cada
colegio recibe la suya, en su propio almacén. El reparto está en
`frontend/src/features/platform/attachment-copies.ts` y el archivo se sube al
enviar la respuesta, no al elegirlo.

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

### El soporte se escribe igual de los dos lados

El colegio y la plataforma escriben en el mismo hilo, así que usan **el mismo
formulario** (`frontend/src/features/support/case-message-form.tsx`): mismos
campos, mismo bloque de adjuntos, mismos botones y el mismo bloque «Para»,
que dice a quién va el mensaje. La respuesta del colegio sale en un modal,
como la de la plataforma, y no dentro del cajón del caso.

El modal de **Enviar solicitud** y el de **Nueva asignación** tienen el mismo
ancho (`max-w-xl`), las mismas etiquetas y el mismo pie de botones: el
`Cancelar` y la acción principal.

### La mesa de la plataforma

**Soporte y auditoría** (`/super/soporte`) tiene el mismo formato que el
**Soporte** del colegio: la lista al ancho, el corte en páginas de diez y el
pie con los números. La diferencia es que la plataforma **responde**:

| Acción | Dónde |
| --- | --- |
| **Responder** | En el caso: se abre desde el título de la fila y se responde en su panel |
| **Enviar solicitud** | Arriba a la derecha: abre una conversación con un colegio |

La plataforma puede, por tanto, **empezar** la conversación: el caso se crea
en nombre del colegio (`POST /v1/platform/cases`), el hilo arranca con el
mensaje del equipo y el colegio lo ve en su propio Soporte, con su campana
avisando.

### Los chips son cuadrados

El panel es rectangular: los chips, las etiquetas y los contadores también
(esquinas de 4 px). Lo que es un círculo por naturaleza —el interruptor, el
radio, la barra de progreso, el punto de estado y el avatar— se queda
circular.

### La campana avisa de los casos

Los dos lados se enteran por la **campana** de la barra superior:

| Qué pasa | Quién lo recibe | Qué dice |
| --- | --- | --- |
| El colegio abre una solicitud | El equipo de Lumen | «Nuevo caso de soporte: {asunto}» |
| El colegio escribe en el hilo | El equipo de Lumen | «Respuesta en el caso {código}» |
| La plataforma responde | Los administradores del colegio | «El equipo de Lumen respondió tu caso {código}» |

Cada notificación lleva a su sitio: la plataforma a `/super/soporte`, el
colegio a `/admin/soporte`. La lista de la mesa se refresca sola cuando
llega una de ellas, sin recargar la página.

Los tipos son `support_case_opened` y `support_case_replied`
(`app/db/enums.py`), y la migración que los agrega al enum de Postgres es
`backend/migrations/20261125010000_support_notifications.sql`.

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
producto: entrar como administrador, ver la biblioteca habilitada del colegio,
cargar un recurso propio y verlo en la biblioteca, crear un docente,
asignarlo a un curso y comprobar que la asignación dice cuánto material ve el
docente, activar un simulacro y abrir una solicitud de soporte.

> En una máquina sin las librerías del sistema del navegador, Playwright no
> arranca. El comando `npx playwright install --with-deps` las instala, y
> necesita permisos de administrador del sistema.
