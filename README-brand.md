# La marca de Lumen

El logo es un **badge verde con la L de cinta calada**: la cinta dobla a 45°
en la punta de arriba y en la del brazo, y en la esquina inferior izquierda
se ve la segunda vuelta de cinta, en teal oscuro.

## Los archivos

| Archivo | Qué es |
| --- | --- |
| `assets/brand/logo-lumen.svg` | El vector final (`viewBox="0 0 1024 1024"`), con degradados y pliegues. |
| `assets/brand/logo-lumen-mono.svg` | La variante de un solo color (favicon, impresión). Sale del mismo path. |
| `assets/brand/logo-lumen-{512,256,128,64,32,16}.png` | Las exportaciones con transparencia real. |
| `assets/brand/favicon.svg` / `favicon.png` | El favicon: el SVG y su PNG de 32 px. |
| `tools/brand_geometry.py` | **La fuente de la forma**: medidas, superelipse, cinta y pliegues. |
| `tools/build_brand.py` | Genera el SVG, el monocolor, los PNG y el componente de React. |
| `tools/verify_logo.py` | Mide IoU y error de color; deja la comparación en `build/`. |

## Cómo se regenera

```bash
pip install cairosvg numpy pillow            # o: uv run --with cairosvg --with numpy --with pillow
python3 tools/build_brand.py                 # SVG, PNG y componente de React
python3 tools/verify_logo.py                 # IoU y error de color
python3 tools/verify_logo.py --ref assets/brand/logo-fuente.png   # contra el PNG de origen
```

`build_brand.py` copia los archivos a `frontend/public/brand/` y escribe
`frontend/src/components/brand-mark.tsx`: la app y las exportaciones nunca
se separan. Los PNG de la app (`frontend/public/favicon.*`,
`favicon-lumen.*`, `og-lumen.*`) salen de los generadores de `frontend/`:
`npm run favicon`, `npm run icons`, `npm run og`.

## Los colores

| Uso | Hex |
| --- | --- |
| Verde de marca (primario) | `#3FC412` |
| Verde profundo (texto y acentos) | `#04642A` |
| Tinta sobre el logo | `#014520` |
| Gris esmeralda del borde izquierdo | `#2ABC60` |
| Teal del pliegue (oscuro → claro) | `#025E35` → `#0A8249` |
| Banda iluminada del pliegue | `#3FCF56` → `#1EA940` |

En CSS están como `--color-brand-green` y `--color-brand-green-deep`
(`frontend/src/styles.css`). Son el color de la **marca**, no el acento de
la interfaz: ese lo dan el colegio y el rol.

## Cómo se usa

```tsx
import { BrandLogo } from "@/components/brand-logo";

<BrandLogo className="size-[30px]" />;
```

```html
<img src="/brand/logo-lumen.svg" width="30" height="30" alt="Lumen" />
```

```css
.brand {
  background-image: url("/brand/logo-lumen.svg");
  background-size: contain;
}
```

El favicon de la app es `frontend/public/favicon.ico` (y `favicon.png`), que
se genera con `npm run favicon` a partir del mismo SVG.
