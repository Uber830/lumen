# El Índice — la guía de estilo del sitio público

La landing (`/`) y el acceso (`/login`) tienen su propia dirección visual,
separada de la del panel de la aplicación. Este documento explica cómo se
construye, para que las dos páginas se parezcan entre sí y para que nadie
tenga que adivinar por qué un botón tiene el borde que tiene.

## Los tokens

Viven en `frontend/src/features/site/site.css`, dentro de la clase de ámbito
`.idx-site`. No están en `:root` a propósito: el panel tiene su propia paleta
(índigo, esquinas redondeadas) y el sitio público la suya (papel, esquinas
rectas). El ámbito mantiene los dos sistemas separados sin un segundo juego de
variables globales.

| Token | Valor | Para qué |
| --- | --- | --- |
| `--bg` | `#FCFCFD` | Fondo de página |
| `--paper` | `#F3F4F7` | Bandas alternas, cabeceras de tabla |
| `--paper-2` | `#EAECF1` | Chips neutros, zonas inertes |
| `--ink` | `#0A0D13` | Títulos y texto principal |
| `--ink-2` | `#565E6E` | Texto secundario |
| `--ink-3` | `#8B93A3` | Etiquetas, unidades, metadatos |
| `--line` | `#DFE3EA` | Separadores |
| `--line-2` | `#C6CCD8` | Bordes de control, chips |
| `--accent` | `#1A4CF0` | El único color de marca |
| `--accent-soft` | `rgba(26,76,240,.08)` | Fondo de la fila al pasar el cursor |
| `--radius` | `4px` | El radio de los controles rectangulares |
| `--maxw` | `1220px` | El ancho del contenido |

El tema de Tailwind los expone como utilidades (`src/styles.css`):

```css
@theme inline {
  --color-paper: var(--paper);
  --color-ink: var(--ink);
  --color-brand: var(--accent);
  --radius-idx: 4px;
}
```

`bg-paper`, `text-ink`, `border-line`, `bg-brand`, `rounded-idx`.

## La retícula

La página lleva un cuaderno muy tenue detrás de todo, fijo y sin capturar el
puntero. Vive en `.idx-site::before`, no en `body::before`: el panel no la
pide y no debe pagar por ella.

## Las reglas

- **Botones rectangulares**, radio de 4 px. Tres variantes: sólido tinta
  (`solid`), contorno (`outline`) y acento azul (`accent`). **Una sola
  acción primaria por pantalla.**
- **Tipografía:** Space Grotesk para el texto, IBM Plex Mono para las
  etiquetas, las referencias y las cifras. Los títulos llevan
  `letter-spacing` negativo.
- **Kicker de sección:** monoespaciada, versalitas, con el identificador del
  índice (`IDX-001`) y una línea que se estira hasta el borde.
- **Tablas:** cabecera en tinta con texto blanco, filas con `hover` en
  `--accent-soft`, bordes hairline, `<caption>` y `<th scope="col">`.
- **Marcas de corte:** los paneles tipo spec llevan una L de 14 px en
  `--accent` al 50 % en dos esquinas opuestas.
- **Sin sombras difusas:** las superficies se separan por borde.
- **Sin degradados decorativos:** el único color de marca es el azul.

## El contenido

Todo el texto visible de la landing sale de `GET /v1/public/site`. La fila de
`site_content` con la clave `landing` guarda el copy y las cifras; el
catálogo editorial vive en `catalog_items` y `catalog_item_schools`.

El frontend no tiene constantes de contenido: `src/features/site/types.ts`
describe el contrato y los componentes renderizan lo que llega. Cuando el
equipo de plataforma edita la fila, la página cambia sin redesplegar.

**Los nombres de los colegios del catálogo son una decisión de publicación.**
No se sacan de la tabla de tenants: se escriben a mano, uno por uno, para que
publicar un cliente sea siempre un acto explícito. La pantalla de acceso
muestra filas de ejemplo (`Colegio Alfa`, `Colegio Beta`…), nunca clientes
reales.

**El acceso no tiene puerta de registro.** Nadie se registra solo: el colegio
habla con el equipo de plataforma y el equipo da de alta el colegio desde
`POST /v1/platform/schools`, con un enlace de activación para el
administrador. La pantalla de acceso ofrece, como mucho, escribir al equipo.

## Los iconos

SVG en línea, sin emoji. El logo es un `<svg aria-hidden="true">` y la marca
viaja como texto al lado. Los ficheros de `public/` (favicon, imagen de
compartir) se generan con scripts:

```bash
npm run favicon   # el icono del panel
npm run icons     # el sol del sitio público
npm run og        # la imagen de compartir (1200x630)
```

## Accesibilidad

- El primer elemento enfocable de la landing es el enlace de salto.
- Todos los controles tienen foco visible (`focus-visible` con el azul de
  acento).
- Los estados del catálogo se distinguen **por texto**, no solo por color.
- Los errores del formulario se anuncian con `aria-live="polite"` y se
  asocian al campo con `aria-describedby`.
- Las preguntas son `<details>` nativos: funcionan con el teclado sin una
  línea de JavaScript.
- `prefers-reduced-motion` desactiva las transiciones del sitio.

## Responsive

| Ancho | Qué pasa |
| --- | --- |
| ≥ 1200 px | La tabla del índice muestra las cinco columnas |
| 1024–1199 px | Igual, con menos aire; el hero pasa a una columna si no cabe |
| 768–1023 px | La tabla oculta «Área» y «Estado»; el estado viaja bajo el título |
| < 768 px | La tabla se convierte en fichas apiladas; la navegación colapsa |

**Nunca hay scroll horizontal**, desde 320 px. Hay una prueba end to end que
lo comprueba.

## La tipografía

Space Grotesk e IBM Plex Mono se auto-alojan (`@fontsource`), solo el
subconjunto latino, con `font-display: swap`. La landing no depende de un CDN.
