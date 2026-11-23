#!/usr/bin/env python3
"""
Compara el SVG reconstruido contra el PNG de referencia del logo Lumen.

Uso:
    python3 tools/verify_logo.py --svg assets/brand/logo-lumen.svg
    python3 tools/verify_logo.py --ref assets/brand/logo-fuente.png \
            --svg assets/brand/logo-lumen.svg --out build/logo-compare.png

Sin `--ref` el script trabaja contra la *referencia sintetica*: la
silueta que describen las medidas documentadas (la superelipse n=4 con
la L de seis vertices calada) y la paleta de los doce puntos medidos
en el PNG de origen. Eso permite auditar la geometria y el color
aunque el PNG no este a mano.

Metricas:
    - IoU de silueta (badge + L)   -> objetivo >= 0.95
    - error medio |dRGB|            -> objetivo <= 25 (sobre 255)

Salida:
    - build/logo-compare.png  (referencia | reconstruccion)
    - build/logo-overlay.png  (overlay 50/50)

Renderizadores admitidos (usa el primero que exista):
    rsvg-convert | inkscape | cairosvg | gdk-pixbuf-thumbnailer |
    chromium/playwright | sharp (node) | convert (ImageMagick)
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import brand_geometry as g  # noqa: E402

REF_BOX = g.REF_BADGE_BOX  # bbox del badge en el PNG de referencia
SVG_BOX = g.BADGE_BOX  # bbox equivalente en el lienzo de 1024


# --- El renderizado ---------------------------------------------------------


def render_svg(svg_path, w, h, out_path, transparent=True):
    """Renderiza el SVG a PNG de w x h."""
    background = None if transparent else "white"

    if shutil.which("rsvg-convert"):
        subprocess.run(
            ["rsvg-convert", "-w", str(w), "-h", str(h), "-o", out_path, svg_path], check=True
        )
        return out_path
    if shutil.which("inkscape"):
        subprocess.run(
            ["inkscape", svg_path, "-w", str(w), "-h", str(h), "-o", out_path], check=True
        )
        return out_path
    try:
        import cairosvg

        cairosvg.svg2png(
            url=svg_path,
            write_to=out_path,
            output_width=w,
            output_height=h,
            background_color=background,
        )
        return out_path
    except ImportError:
        pass
    if shutil.which("gdk-pixbuf-thumbnailer"):
        subprocess.run(
            [
                "gdk-pixbuf-thumbnailer",
                "-s",
                str(max(w, h)),
                svg_path,
                out_path,
            ],
            check=True,
        )
        return out_path
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(args=["--no-sandbox"])
            page = browser.new_page(viewport={"width": w, "height": h})
            page.set_content(
                f'<body style="margin:0;background:#fff">'
                f'<img src="file://{os.path.abspath(svg_path)}" '
                f'style="width:{w}px;height:{h}px;display:block"></body>'
            )
            page.wait_for_timeout(500)
            page.screenshot(path=out_path)
            browser.close()
        return out_path
    except ImportError:
        pass

    # sharp (node): el frontend lo trae como dependencia.
    node = shutil.which("node")
    if node:
        root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        helper = os.path.join(root, "frontend", "scripts", "render-svg.mjs")
        if os.path.exists(helper):
            subprocess.run(
                [node, helper, svg_path, out_path, str(w), str(h)], check=True, cwd=root
            )
            return out_path

    if shutil.which("convert"):
        subprocess.run(
            ["convert", "-background", "none", "-resize", f"{w}x{h}", svg_path, out_path],
            check=True,
        )
        return out_path

    raise SystemExit("No hay ningun rasterizador disponible (rsvg, inkscape, cairosvg, sharp...).")


def aligned_svg(svg_text, width, height):
    """El SVG alineado al lienzo de referencia."""
    inner = re.sub(r"^.*?<svg[^>]*>", "", svg_text, flags=re.S).replace("</svg>", "")
    s = (REF_BOX[2] - REF_BOX[0]) / (SVG_BOX[2] - SVG_BOX[0])
    tx = REF_BOX[0] - SVG_BOX[0] * s
    ty = REF_BOX[1] - SVG_BOX[1] * s
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}">'
        f'<g transform="translate({tx},{ty}) scale({s})">{inner}</g></svg>'
    )


def silhouette_svg(size):
    """La silueta documentada: el badge con la L calada."""
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {g.CANVAS} {g.CANVAS}" width="{size}" height="{size}">
<path fill-rule="evenodd" fill="#ffffff" d="{g.badge_path()} {g.tape_path()}"/>
</svg>
"""


# --- Las mascaras -----------------------------------------------------------


def badge_mask(img):
    """Mascara del logo (verde o blanco) sobre fondo transparente."""
    a = np.array(img.convert("RGBA")).astype(int)
    r, green, b, al = a[:, :, 0], a[:, :, 1], a[:, :, 2], a[:, :, 3]
    green_mask = (al > 200) & (green > r + 25) & (green > b + 25)
    white = (al > 200) & (abs(r - green) < 12) & (abs(green - b) < 12) & (r > 235)
    return green_mask | white


def alpha_mask(img):
    """Mascara de lo opaco."""
    return np.array(img.convert("RGBA")).astype(int)[:, :, 3] > 128


# --- La comparacion ---------------------------------------------------------


def compare_with_reference(ref_path, svg_path, out_path):
    """La comparacion completa contra el PNG de referencia."""
    ref = Image.open(ref_path).convert("RGBA")
    width, height = ref.size
    tmp = tempfile.mkdtemp()
    ren_path = os.path.join(tmp, "render.png")

    svg = open(svg_path, encoding="utf8").read()
    wrapped = os.path.join(tmp, "aligned.svg")
    with open(wrapped, "w", encoding="utf8") as handle:
        handle.write(aligned_svg(svg, width, height))
    render_svg(wrapped, width, height, ren_path)

    ren = Image.open(ren_path).convert("RGBA")
    a = np.array(ref).astype(int)
    b = np.array(ren).astype(int)
    ma, mb = badge_mask(ref), badge_mask(ren)
    inter = (ma & mb).sum()
    union = (ma | mb).sum()
    iou = inter / union if union else 0.0
    delta = np.abs(a[:, :, :3] - b[:, :, :3]).sum(axis=2)
    derr = delta[ma & mb].mean() / 3 if (ma & mb).any() else 999.0

    print(f"IoU silueta      : {iou:.4f}   (objetivo >= 0.95)")
    print(f"error medio RGB  : {derr:.1f}    (objetivo <= 25)")

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    sbs = Image.new("RGB", (width * 2 + 24, height), "#bbbbbb")
    sbs.paste(ref.convert("RGB"), (0, 0))
    sbs.paste(ren.convert("RGB"), (width + 24, 0))
    sbs.save(out_path)
    sbs.resize((1500, int(1500 * height / (width * 2 + 24)))).save(
        out_path.replace(".png", "-small.png")
    )

    overlay = Image.blend(ref.convert("RGB"), ren.convert("RGB"), 0.5)
    overlay.save(out_path.replace(".png", "-overlay.png"))
    print(f"comparacion -> {out_path}")
    print(f"overlay     -> {out_path.replace('.png', '-overlay.png')}")
    return iou, derr


def compare_with_synthetic(svg_path, out_path):
    """La comparacion contra la referencia documentada (sin el PNG)."""
    tmp = tempfile.mkdtemp()
    size = 1024
    ren_path = os.path.join(tmp, "render.png")
    ref_path = os.path.join(tmp, "silueta.png")

    with open(ref_path, "w", encoding="utf8") as handle:
        handle.write(silhouette_svg(size))
    render_svg(ref_path, size, size, ref_path)
    render_svg(svg_path, size, size, ren_path)

    ref = Image.open(ref_path).convert("RGBA")
    ren = Image.open(ren_path).convert("RGBA")
    ma, mb = alpha_mask(ref), alpha_mask(ren)
    inter = (ma & mb).sum()
    union = (ma | mb).sum()
    iou = inter / union if union else 0.0

    # El error de color: los doce puntos medidos en el PNG de origen.
    ren_px = np.array(ren).astype(int)
    total = 0.0
    rows = []
    for (sx, sy), expected, note in g.REFERENCE_PALETTE:
        vx, vy = g.source_to_view(sx, sy)
        px = ren_px[int(round(vy)), int(round(vx))]
        want = tuple(int(expected[i : i + 2], 16) for i in (1, 3, 5))
        diff = np.abs(np.array(px[:3]) - np.array(want))
        total += diff.mean()
        rows.append((sx, sy, expected, tuple(px[:3]), diff.mean(), note))

    derr = total / len(rows)

    print("referencia: sintetica (las medidas documentadas; el PNG de origen no esta a mano)")
    print(f"IoU silueta      : {iou:.4f}   (objetivo >= 0.95)")
    print(f"error medio RGB  : {derr:.1f}    (objetivo <= 25, sobre los 12 puntos medidos)")
    print("")
    print(f"{'punto':>12}  {'esperado':>8}  {'obtenido':>18}  {'delta':>6}  zona")
    for sx, sy, expected, got, diff, note in rows:
        got_hex = "#%02X%02X%02X" % tuple(got)
        print(f"{f'({sx},{sy})':>12}  {expected:>8}  {got_hex:>18}  {diff:6.1f}  {note}")

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    sbs = Image.new("RGB", (size * 2 + 24, size), "#bbbbbb")
    sbs.paste(ref.convert("RGB"), (0, 0))
    sbs.paste(ren.convert("RGB"), (size + 24, 0))
    sbs.save(out_path)

    # El overlay 50/50 sobre el lienzo de la referencia.
    overlay = Image.blend(ref.convert("RGB"), ren.convert("RGB"), 0.5)
    overlay.save(out_path.replace(".png", "-overlay.png"))
    print("")
    print(f"comparacion -> {out_path}")
    print(f"overlay     -> {out_path.replace('.png', '-overlay.png')}")
    return iou, derr


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--ref", default=None, help="el PNG de referencia")
    parser.add_argument("--svg", default="assets/brand/logo-lumen.svg")
    parser.add_argument("--out", default="build/logo-compare.png")
    parser.add_argument("--size", type=int, default=1263)
    args = parser.parse_args()

    if args.ref and os.path.exists(args.ref):
        iou, derr = compare_with_reference(args.ref, args.svg, args.out)
    else:
        if args.ref:
            print(f"[aviso] no existe {args.ref}: se usa la referencia sintetica")
        iou, derr = compare_with_synthetic(args.svg, args.out)

    ok = iou >= 0.95 and derr <= 25
    print("")
    print("resultado:", "OK" if ok else "FUERA DE UMBRAL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
