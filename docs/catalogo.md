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
exige título, tipo, área, grados y al menos un colegio; si falta algo, la
respuesta es un `422` con la lista de lo que falta en `missing`.

Quitarle el acceso a un colegio a una pieza publicada devuelve `409` con los
colegios afectados, y el cliente lo reenvía con `{"confirm": true}`.

## La cobertura

La cobertura de un colegio cuenta las piezas publicadas que puede ver. El
interruptor de acceso es de una pieza por colegio: encenderlo o apagarlo no
toca a los demás colegios de la red.

## Decisiones que se tomaron sin respuesta del negocio

- **El prefijo es `/v1/platform`**, no `/api/platform`: es la convención del
  repositorio (`/v1/auth`, `/v1/schools`, `/v1/public`).
- **El almacenamiento de los archivos** es el adaptador que ya tenía el
  proyecto (`app/core/supabase_storage.py`), detrás de la interfaz de
  `app/platform/storage.py`. Cambiar de destino es cambiar el adaptador, no el
  catálogo; el bucket es configurable.
- **Los formatos admitidos** son PDF, EPUB, DOCX, MP4 y ZIP.
- **ISBN, autor y editorial no bloquean la publicación**: son opcionales.
- **Los avisos al equipo de plataforma** se registran en `audit_log` y se
  muestran en la vista de soporte y auditoría; el centro de notificaciones en
  la aplicación llega con esa vista.

Los endpoints están en el
[README del backend](../backend/README.md#plataforma).
