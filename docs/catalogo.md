# El catálogo editorial

El catálogo que carga el equipo de plataforma. Vive en `public.materials` y sus
tablas hijas: `material_files` (los archivos), `material_schools` (qué colegio
ve cada pieza), `material_history` (qué pasó y quién lo hizo) y `audit_log`
(la traza de los eventos críticos). La tabla vieja `catalog_items` se
transformó en `materials` en la migración `20261119010000` y se eliminó.

## El vocabulario

Una pieza se llama por su **referencia** (`ref`, el código que se ve en las
tablas), tiene un **tipo** pedagógico (Libro, Guía…), un **formato**
(`kind`: pdf, epub, docx, mp4, zip) y un **estado** (`state`):

| Estado | Qué significa |
| --- | --- |
| `borrador` | la carga está en curso; no se ve en ningún colegio |
| `en_revision` | el equipo editorial lo está mirando |
| `publicado` | se puede habilitar a los colegios |
| `archivado` | se retiró del catálogo |

Los estados se guardan en español en la base y la API los cuenta en el borde:
el panel de plataforma trabaja con `draft`, `review`, `published` y `archived`,
que es el vocabulario que ya usaba.

## El ciclo de vida

**Las transiciones válidas las decide el backend** (`available_transitions` en
la respuesta del detalle): el frontend las muestra, no las adivina. Publicar
exige título, tipo, área y al menos un colegio; si falta algo, la
respuesta es un `422` con la lista de lo que falta en `missing`.

Los **grados son opcionales**: una pieza sin grados es una pieza para todos los
grados del colegio, así que nunca son un motivo para bloquear la publicación.

Quitarle el acceso a un colegio a una pieza publicada devuelve `409` con los
colegios afectados, y el cliente lo reenvía con `{"confirm": true}`.

## Los valores se editan

El panel de **Gestionar** de la biblioteca es un **modal en el centro**, no un
cajón: la pieza se administra en el medio de la pantalla, con el formulario
completo a la vista. Ahí se cambian el título, el tipo, el área, los grados,
para quién es la pieza y la descripción, con
`PATCH /v1/platform/catalog/{id}`. El botón **Guardar cambios** solo se
enciende cuando algo cambió, y el cambio queda en el historial del material y
en la traza de auditoría.

## El ojo: ver la pieza

Cada tarjeta de la biblioteca tiene dos acciones: el **ojo** y **Gestionar**.

El **ojo** abre la pieza como es: una imagen como imagen, un PDF en el lector
del navegador, un video con sus controles. Una pieza que solo es un enlace
externo lo dice y ofrece el enlace. El archivo lo sirve la API
(`GET /v1/platform/files/{id}`) **en línea**: el material se consulta, no se
descarga, como en el resto del producto.

## A qué colegios va la pieza

Antes de la lista de colegios hay una **decisión**:

| Decisión | Qué pasa |
| --- | --- |
| **Todos los colegios** | La pieza se habilita para toda la red (`all_schools: true`) y la lista de colegios no se muestra |
| **Ciertos colegios** | Aparece la lista y solo ven la pieza los que se elijan |

Así nadie deja la lista en blanco por descuido: lo que no se elige es una
decisión, no un olvido.

## La cobertura

La cobertura de un colegio cuenta las piezas publicadas que puede ver. El
interruptor de acceso es de una pieza por colegio: encenderlo o apagarlo no
toca a los demás colegios de la red.

## Decisiones que se tomaron sin respuesta del negocio

- **El prefijo es `/v1/platform`**, no `/api/platform`: es la convención del
  repositorio (`/v1/auth`, `/v1/schools`, `/v1/public`).
- **El almacenamiento de los archivos** es `LocalMaterialStorage`, el adaptador
  que vive detrás de la interfaz de `app/platform/storage.py`. Escribe en el
  disco del servidor: los archivos van a `backend/var/materiales` (la carpeta
  que nombra `PLATFORM_STORAGE_DIR`). Cambiar de destino es cambiar el
  adaptador, no el catálogo; la carpeta es configurable.
- **Los formatos admitidos** son PDF, EPUB, DOCX, MP4 y ZIP.
- **ISBN, autor y editorial no bloquean la publicación**: son opcionales.
- **Los avisos al equipo de plataforma** se registran en `audit_log` y se
  muestran en la vista de soporte y auditoría; el centro de notificaciones en
  la aplicación llega con esa vista.

Los endpoints están en el
[README del backend](../backend/README.md#plataforma).
