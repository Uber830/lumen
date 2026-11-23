#!/usr/bin/env python3
"""
Construye el logo de Lumen: el SVG, su version monocroma y los PNG.

El dibujo sale de `tools/brand_geometry.py`, que es la unica fuente de
la forma. Este script solo la serializa y la exporta.

Uso:
    python3 tools/build_brand.py [--out assets/brand] [--public frontend/public/brand]

Idempotente: se puede volver a ejecutar las veces que haga falta.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import brand_geometry as g  # noqa: E402

SVG_SIZES = (512, 256, 128, 64, 32, 16)


# --- El SVG -----------------------------------------------------------------


def _stop(offset: float, color: str, opacity: float = 1.0) -> str:
    op = "" if opacity >= 1.0 else f' stop-opacity="{opacity}"'
    return f'<stop offset="{_num(offset)}" stop-color="{color}"{op}/>'


def _num(value: float) -> str:
    return f"{value:.3f}".rstrip("0").rstrip(".") or "0"


def _rgb(color: tuple[int, int, int]) -> str:
    return "#%02X%02X%02X" % color


def build_svg(mono: bool = False) -> str:
    """El SVG final. En monocolor solo queda el badge con la L calada."""
    badge = g.badge_path()
    tape = g.tape_path()

    if mono:
        return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {g.CANVAS} {g.CANVAS}" width="{g.CANVAS}" height="{g.CANVAS}" role="img" aria-labelledby="titulo desc">
  <title id="titulo">Lumen</title>
  <desc id="desc">El logo de Lumen: una L de cinta calada dentro de un badge verde redondeado.</desc>
  <path fill-rule="evenodd" clip-rule="evenodd" fill="{g.BRAND_GREEN}" d="{badge} {tape}"/>
</svg>
"""

    base_stops = "".join(_stop(o, _rgb(c)) for o, c in g.BASE_STOPS)
    radial_stops = "".join(_stop(o, c, op) for o, c, op in g.RADIAL_STOPS)
    edge_stops = "".join(_stop(o, c, op) for o, c, op in g.EDGE_STOPS)
    facet_a_stops = "".join(_stop(o, c) for o, c in g.FACET_A_STOPS)
    fold_dark_stops = "".join(_stop(o, c) for o, c in g.FOLD_DARK_STOPS)

    # El pliegue B: la banda iluminada se apaga a lo ancho del pliegue.
    nx, ny = g.fold_normal()
    band_x1, band_y1 = g.FOLD_START
    band_x2, band_y2 = g.FOLD_START[0] + nx * g.FOLD_BAND_WIDTH, g.FOLD_START[1] + ny * g.FOLD_BAND_WIDTH
    band_stops = (
        f'<stop offset="0" stop-color="#3FCF56"/>'
        f'<stop offset="0.55" stop-color="#1EA940" stop-opacity="0.62"/>'
        f'<stop offset="1" stop-color="#1EA940" stop-opacity="0"/>'
    )

    cx = g.BADGE_BOX[0] + g.RADIAL_CENTER[0] * (g.BADGE_BOX[2] - g.BADGE_BOX[0])
    cy = g.BADGE_BOX[1] + g.RADIAL_CENTER[1] * (g.BADGE_BOX[3] - g.BADGE_BOX[1])
    r = g.RADIAL_RADIUS * (g.BADGE_BOX[2] - g.BADGE_BOX[0])

    # El degradado base vive sobre el alto del badge; el del borde derecho,
    # sobre el ancho del lienzo: su punto mas vivo cae en el borde.
    base_y1, base_y2 = g.BADGE_BOX[1], g.BADGE_BOX[3]
    edge_x1, edge_x2 = 0, g.CANVAS

    # Cada capa lleva la L calada: el badge y la cinta en un solo path con
    # `fill-rule="evenodd"`, para que la cinta sea un hueco y no un color.
    cuerpo = f'd="{badge} {tape}" fill-rule="evenodd"'

    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {g.CANVAS} {g.CANVAS}" width="{g.CANVAS}" height="{g.CANVAS}" role="img" aria-labelledby="titulo desc">
  <title id="titulo">Lumen</title>
  <desc id="desc">El logo de Lumen: una L de cinta calada dentro de un badge verde con degradado, con la punta de la cinta doblada y el pliegue de la esquina inferior izquierda.</desc>
  <defs>
    <linearGradient id="base" gradientUnits="userSpaceOnUse" x1="0" y1="{_num(base_y1)}" x2="0" y2="{_num(base_y2)}">
      {base_stops}
    </linearGradient>
    <radialGradient id="brillo" gradientUnits="userSpaceOnUse" cx="{_num(cx)}" cy="{_num(cy)}" r="{_num(r)}">
      {radial_stops}
    </radialGradient>
    <linearGradient id="borde" gradientUnits="userSpaceOnUse" x1="{_num(edge_x1)}" y1="0" x2="{_num(edge_x2)}" y2="0">
      {edge_stops}
    </linearGradient>
    <linearGradient id="mascaraBorde" gradientUnits="userSpaceOnUse" x1="0" y1="{_num(g.BADGE_BOX[1])}" x2="0" y2="{_num(g.EDGE_MASK_Y)}">
      <stop offset="0" stop-color="#FFFFFF"/>
      <stop offset="0.9" stop-color="#FFFFFF"/>
      <stop offset="1" stop-color="#000000"/>
    </linearGradient>
    <mask id="recorteBorde" maskUnits="userSpaceOnUse" x="0" y="0" width="{g.CANVAS}" height="{g.CANVAS}">
      <rect x="0" y="0" width="{g.CANVAS}" height="{g.CANVAS}" fill="url(#mascaraBorde)"/>
    </mask>
    <linearGradient id="facetaA" gradientUnits="userSpaceOnUse" x1="0" y1="{_num(g.FACET_A[0][1])}" x2="0" y2="{_num(g.FACET_A[2][1])}">
      {facet_a_stops}
    </linearGradient>
    <linearGradient id="pliegueB" gradientUnits="userSpaceOnUse" x1="{_num(g.FOLD_START[0])}" y1="{_num(g.FOLD_START[1])}" x2="{_num(g.fold_end_on_badge()[0])}" y2="{_num(g.fold_end_on_badge()[1])}">
      {fold_dark_stops}
    </linearGradient>
    <linearGradient id="bandaB" gradientUnits="userSpaceOnUse" x1="{_num(band_x1)}" y1="{_num(band_y1)}" x2="{_num(band_x2)}" y2="{_num(band_y2)}">
      {band_stops}
    </linearGradient>
  </defs>
  <path {cuerpo} fill="url(#base)"/>
  <path {cuerpo} fill="url(#brillo)" opacity="{_num(g.RADIAL_OPACITY)}"/>
  <path {cuerpo} fill="url(#borde)" mask="url(#recorteBorde)"/>
  <path d="{g.polygon_path(g.FACET_A)}" fill="url(#facetaA)"/>
  <path d="{g.facet_b_dark_path()}" fill="url(#pliegueB)"/>
  <path d="{g.facet_b_band_path()}" fill="url(#bandaB)"/>
</svg>
"""


# --- El componente de React -------------------------------------------------


def build_jsx() -> str:
    """El mismo dibujo, como componente de React para la app."""
    badge = g.badge_path()
    tape = g.tape_path()

    base_stops = "\n".join(
        f'      <stop offset="{_num(o)}" stopColor="{_rgb(c)}" />' for o, c in g.BASE_STOPS
    )
    radial_stops = "\n".join(
        f'      <stop offset="{_num(o)}" stopColor="{c}" stopOpacity={{{_num(op)}}} />'
        for o, c, op in g.RADIAL_STOPS
    )
    edge_stops = "\n".join(
        f'      <stop offset="{_num(o)}" stopColor="{c}" stopOpacity={{{_num(op)}}} />'
        for o, c, op in g.EDGE_STOPS
    )
    facet_a_stops = "\n".join(
        f'      <stop offset="{_num(o)}" stopColor="{c}" />' for o, c in g.FACET_A_STOPS
    )
    fold_dark_stops = "\n".join(
        f'      <stop offset="{_num(o)}" stopColor="{c}" />' for o, c in g.FOLD_DARK_STOPS
    )

    cx = g.BADGE_BOX[0] + g.RADIAL_CENTER[0] * (g.BADGE_BOX[2] - g.BADGE_BOX[0])
    cy = g.BADGE_BOX[1] + g.RADIAL_CENTER[1] * (g.BADGE_BOX[3] - g.BADGE_BOX[1])
    r = g.RADIAL_RADIUS * (g.BADGE_BOX[2] - g.BADGE_BOX[0])
    nx, ny = g.fold_normal()
    band_x2 = g.FOLD_START[0] + nx * g.FOLD_BAND_WIDTH
    band_y2 = g.FOLD_START[1] + ny * g.FOLD_BAND_WIDTH

    return f"""// =============================================================================
// La marca de Lumen.
// -----------------------------------------------------------------------------
// Este archivo lo genera `tools/build_brand.py`: no se edita a mano.
// La forma vive en `tools/brand_geometry.py`, que es la fuente unica del
// logo (SVG, PNG y este componente salen de ahi).
// =============================================================================

/** La marca de la app: el badge verde con la L de cinta calada. */
export function BrandMark({{ className = "" }}: {{ className?: string }}) {{
  return (
    <svg
      viewBox="0 0 {g.CANVAS} {g.CANVAS}"
      aria-hidden="true"
      focusable="false"
      className={{className}}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="lumen-base" gradientUnits="userSpaceOnUse" x1="0" y1="{_num(g.BADGE_BOX[1])}" x2="0" y2="{_num(g.BADGE_BOX[3])}">
{base_stops}
        </linearGradient>
        <radialGradient id="lumen-brillo" gradientUnits="userSpaceOnUse" cx="{_num(cx)}" cy="{_num(cy)}" r="{_num(r)}">
{radial_stops}
        </radialGradient>
        <linearGradient id="lumen-borde" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="{g.CANVAS}" y2="0">
{edge_stops}
        </linearGradient>
        <linearGradient id="lumen-mascara" gradientUnits="userSpaceOnUse" x1="0" y1="{_num(g.BADGE_BOX[1])}" x2="0" y2="{_num(g.EDGE_MASK_Y)}">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.9" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#000000" />
        </linearGradient>
        <mask id="lumen-mascara-borde" maskUnits="userSpaceOnUse" x="0" y="0" width="{g.CANVAS}" height="{g.CANVAS}">
          <rect x="0" y="0" width="{g.CANVAS}" height="{g.CANVAS}" fill="url(#lumen-mascara)" />
        </mask>
        <linearGradient id="lumen-faceted-a" gradientUnits="userSpaceOnUse" x1="0" y1="{_num(g.FACET_A[0][1])}" x2="0" y2="{_num(g.FACET_A[2][1])}">
{facet_a_stops}
        </linearGradient>
        <linearGradient id="lumen-pliegue-b" gradientUnits="userSpaceOnUse" x1="{_num(g.FOLD_START[0])}" y1="{_num(g.FOLD_START[1])}" x2="{_num(g.fold_end_on_badge()[0])}" y2="{_num(g.fold_end_on_badge()[1])}">
{fold_dark_stops}
        </linearGradient>
        <linearGradient id="lumen-banda-b" gradientUnits="userSpaceOnUse" x1="{_num(g.FOLD_START[0])}" y1="{_num(g.FOLD_START[1])}" x2="{_num(band_x2)}" y2="{_num(band_y2)}">
          <stop offset="0" stopColor="#3FCF56" />
          <stop offset="0.55" stopColor="#1EA940" stopOpacity={{0.62}} />
          <stop offset="1" stopColor="#1EA940" stopOpacity={{0}} />
        </linearGradient>
      </defs>
      <path d="{badge} {tape}" fillRule="evenodd" fill="url(#lumen-base)" />
      <path d="{badge} {tape}" fillRule="evenodd" fill="url(#lumen-brillo)" opacity={{{_num(g.RADIAL_OPACITY)}}} />
      <path d="{badge} {tape}" fillRule="evenodd" fill="url(#lumen-borde)" mask="url(#lumen-mascara-borde)" />
      <path d="{g.polygon_path(g.FACET_A)}" fill="url(#lumen-faceted-a)" />
      <path d="{g.facet_b_dark_path()}" fill="url(#lumen-pliegue-b)" />
      <path d="{g.facet_b_band_path()}" fill="url(#lumen-banda-b)" />
    </svg>
  );
}}
"""


# --- La exportacion ---------------------------------------------------------


def render_pngs(svg_path: str, out_dir: str, sizes=SVG_SIZES) -> list[str]:
    """Exporta los PNG con transparencia real."""
    try:
        import cairosvg
    except ImportError as error:  # pragma: no cover
        raise SystemExit(
            "Falta cairosvg para exportar los PNG: pip install cairosvg"
        ) from error

    os.makedirs(out_dir, exist_ok=True)
    written = []
    for size in sizes:
        target = os.path.join(out_dir, f"logo-lumen-{size}.png")
        cairosvg.svg2png(
            url=svg_path,
            write_to=target,
            output_width=size,
            output_height=size,
        )
        written.append(target)
    return written


def format_component(component_path: str, root: str) -> None:
    """El componente generado sale formateado (prettier), si esta disponible."""
    frontend = os.path.join(root, "frontend")
    if not os.path.isdir(os.path.join(frontend, "node_modules")):
        return
    try:
        subprocess.run(
            ["npx", "prettier", "--write", component_path],
            cwd=frontend,
            check=True,
            stdout=subprocess.DEVNULL,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("aviso: no se pudo formatear el componente con prettier")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="assets/brand")
    parser.add_argument("--public", default="frontend/public/brand")
    parser.add_argument("--component", default="frontend/src/components/brand-mark.tsx")
    parser.add_argument("--no-png", action="store_true")
    args = parser.parse_args()

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(root, args.out)
    public_dir = os.path.join(root, args.public)
    os.makedirs(out_dir, exist_ok=True)

    svg = build_svg()
    mono = build_svg(mono=True)

    svg_path = os.path.join(out_dir, "logo-lumen.svg")
    mono_path = os.path.join(out_dir, "logo-lumen-mono.svg")
    with open(svg_path, "w", encoding="utf8") as handle:
        handle.write(svg)
    with open(mono_path, "w", encoding="utf8") as handle:
        handle.write(mono)

    written = [svg_path, mono_path]
    if not args.no_png:
        written += render_pngs(svg_path, out_dir)
        written.append(render_favicon(svg_path, out_dir))

    # La app sirve los mismos archivos.
    os.makedirs(public_dir, exist_ok=True)
    for path in written:
        shutil.copy2(path, os.path.join(public_dir, os.path.basename(path)))

    # El componente de React.
    component_path = os.path.join(root, args.component)
    os.makedirs(os.path.dirname(component_path), exist_ok=True)
    with open(component_path, "w", encoding="utf8") as handle:
        handle.write(build_jsx())
    format_component(component_path, root)

    print(f"logo escrito en {args.out}:")
    for path in written:
        print(f"  - {os.path.relpath(path, root)}")
    print(f"componente: {os.path.relpath(component_path, root)}")


def render_favicon(svg_path: str, out_dir: str) -> str:
    """El favicon: el SVG y su PNG de 32 px."""
    import cairosvg

    favicon_svg = os.path.join(out_dir, "favicon.svg")
    shutil.copy2(svg_path, favicon_svg)
    favicon_png = os.path.join(out_dir, "favicon.png")
    cairosvg.svg2png(url=svg_path, write_to=favicon_png, output_width=32, output_height=32)
    return favicon_png


if __name__ == "__main__":
    main()
