"""
La geometría de la marca de Lumen.
--------------------------------------------------------------------------------
Un solo lugar donde vive la forma: el SVG que se entrega, el PNG que se
exporta, el componente de React que la app usa y la referencia sintética
que sirve para verificar el resultado.

Coordenadas de trabajo: lienzo de 1024 x 1024, badge centrado en
(512, 512). El lienzo de referencia (el PNG de origen) mide 1263 x 1246 y
el badge ocupa x 190..1026, y 208..1043. La conversión es:

    X = (x_fuente - 190) / 835 * 676 + 174
    Y = (y_fuente - 208) / 835 * 676 + 174
"""

from __future__ import annotations

import math

# --- El lienzo y el badge --------------------------------------------------

CANVAS = 1024
CENTER = 512.0
# El semi-eje de la superelipse: |x/a|^n + |y/a|^n = 1.
#
# a = 341 lleva el badge de 171 a 853: tres unidades mas que la caja
# medida (174..850) con la que el verificador alinea el SVG. Se deja
# 341 porque es el valor medido en el prompt y porque los puntos de la
# paleta (la esquina superior derecha, por ejemplo) solo caen dentro del
# badge con ese semi-eje. La diferencia es del 0,9 % del ancho.
A = 341.0
# El exponente de la superelipse (squircle, no un rounded-rect).
N = 4.0
# Muestras con las que se traza la silueta.
SAMPLES = 96

# El bbox del badge en el lienzo de trabajo.
BADGE_BOX = (174.0, 174.0, 850.0, 850.0)

# --- La cinta (la L) -------------------------------------------------------

# Los seis vertices exactos, ya en el lienzo de 1024.
TAPE_POINTS = [
    (522.0, 174.0),
    (522.0, 520.0),
    (843.0, 520.0),
    (680.0, 688.0),
    (349.0, 688.0),
    (349.0, 352.0),
]

# --- La paleta -------------------------------------------------------------

BRAND_GREEN = "#3FC412"  # verde de marca (primario)
BRAND_DEEP = "#04642A"  # verde profundo, para texto y acentos
INK_ON_LOGO = "#014520"  # tinta sobre el logo

# Las paradas del degradado base, de arriba abajo: offset -> RGB.
BASE_STOPS = [
    (0.197, (56, 255, 142)),
    (0.496, (11, 171, 108)),
    (0.796, (9, 134, 52)),
    (1.0, (5, 123, 55)),
]

# El brillo radial de la esquina superior derecha, en coordenadas
# normalizadas del badge.
RADIAL_CENTER = (0.994, -0.055)
RADIAL_RADIUS = 1.226
RADIAL_STOPS = [
    (0.0, "#51E404", 1.0),
    (0.45, "#074D11", 1.0),
    (1.0, "#074D11", 0.0),
]
RADIAL_OPACITY = 0.86

# El brillo del borde derecho: offset -> color/opacidad.
EDGE_STOPS = [
    (0.0, "#3FC412", 0.0),
    (0.55, "#3FC412", 0.10),
    (0.82, "#42C910", 0.55),
    (1.0, "#46CC10", 0.95),
]
# Por debajo de esta Y el logo vuelve a ser oscuro: el brillo del borde
# se apaga con una mascara vertical.
EDGE_MASK_Y = 688.0

# --- Las facetas de los pliegues -------------------------------------------

# Faceta A: la punta de la cinta, arriba a la izquierda (en sombra).
FACET_A = [(349.0, 174.0), (522.0, 174.0), (349.0, 352.0)]
FACET_A_STOPS = [(0.0, "#22961A"), (0.5, "#0C6B1E"), (1.0, "#04451C")]

# Faceta B: el pliegue de la esquina inferior izquierda. La diagonal
# arranca en la esquina de la cinta y baja hacia la izquierda.
FOLD_START = (349.0, 688.0)
FOLD_END = (205.0, 823.0)
FOLD_DARK_STOPS = [(0.0, "#0A8249"), (1.0, "#025E35")]
# La banda iluminada mide ~55 px a lo ancho del pliegue.
FOLD_BAND_WIDTH = 55.0

# --- La referencia: los puntos de color medidos en el PNG de origen --------

REFERENCE_PALETTE = [
    ((945, 260), "#3FC412", "esquina superior derecha (maximo)"),
    ((1020, 460), "#26981A", "borde derecho medio"),
    ((970, 700), "#35BB16", "borde derecho, junto al brazo"),
    ((195, 460), "#2ABC60", "borde izquierdo (esmeralda)"),
    ((230, 400), "#30C15F", "esmeralda claro arriba a la izquierda"),
    ((345, 460), "#15A253", "interior izquierdo (mas oscuro)"),
    ((700, 625), "#034322", "interior, junto a la L (el mas oscuro)"),
    ((700, 950), "#014520", "fondo del badge"),
    ((230, 800), "#088D4E", "inferior izquierdo"),
    ((600, 220), "#209117", "faceta A, arriba"),
    ((430, 300), "#06581F", "faceta A, abajo (oscura)"),
    ((400, 900), "#1CA83F", "banda iluminada del pliegue B"),
]

REF_SIZE = (1263, 1246)
REF_BADGE_BOX = (190, 208, 1026, 1043)


# --- Utilidades de forma ----------------------------------------------------


def source_to_view(x: float, y: float) -> tuple[float, float]:
    """Convierte un punto del PNG de referencia al lienzo de 1024."""
    x0, y0, x1, y1 = REF_BADGE_BOX
    span_x = x1 - x0
    span_y = y1 - y0
    return (
        (x - x0) / span_x * (BADGE_BOX[2] - BADGE_BOX[0]) + BADGE_BOX[0],
        (y - y0) / span_y * (BADGE_BOX[3] - BADGE_BOX[1]) + BADGE_BOX[1],
    )


def squircle_points(samples: int = SAMPLES) -> list[tuple[float, float]]:
    """Los puntos de |x/a|^n + |y/a|^n = 1, starting en el angulo 0."""
    points = []
    exponent = 2.0 / N
    for k in range(samples):
        t = 2.0 * math.pi * k / samples
        ct, st = math.cos(t), math.sin(t)
        x = CENTER + A * math.copysign(abs(ct) ** exponent, ct)
        y = CENTER + A * math.copysign(abs(st) ** exponent, st)
        points.append((x, y))
    return points


def _fmt(value: float) -> str:
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return text if text not in ("", "-0") else "0"


def catmull_rom_path(points: list[tuple[float, float]], closed: bool = True) -> str:
    """La curva como Bezier cubicas (Catmull-Rom -> Bezier)."""
    n = len(points)
    parts = [f"M{_fmt(points[0][0])} {_fmt(points[0][1])}"]
    last = n if closed else n - 1
    for i in range(last):
        p0 = points[(i - 1) % n]
        p1 = points[i % n]
        p2 = points[(i + 1) % n]
        p3 = points[(i + 2) % n]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6.0, p1[1] + (p2[1] - p0[1]) / 6.0)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6.0, p2[1] - (p3[1] - p1[1]) / 6.0)
        parts.append(
            f"C{_fmt(c1[0])} {_fmt(c1[1])} {_fmt(c2[0])} {_fmt(c2[1])} "
            f"{_fmt(p2[0])} {_fmt(p2[1])}"
        )
    if closed:
        parts.append("Z")
    return " ".join(parts)


def badge_path() -> str:
    """La silueta del badge: la superelipse de exponente 4."""
    return catmull_rom_path(squircle_points())


def tape_path() -> str:
    """La L de cinta, con los seis vertices exactos."""
    head = "M"
    body = " L".join(f"{_fmt(x)} {_fmt(y)}" for x, y in TAPE_POINTS)
    return f"{head}{body} Z"


def polygon_path(points: list[tuple[float, float]]) -> str:
    head = f"M{_fmt(points[0][0])} {_fmt(points[0][1])}"
    rest = " ".join(f"L{_fmt(x)} {_fmt(y)}" for x, y in points[1:])
    return f"{head} {rest} Z"


def _inside_badge(x: float, y: float) -> float:
    dx, dy = (x - CENTER) / A, (y - CENTER) / A
    return abs(dx) ** N + abs(dy) ** N - 1.0


def fold_end_on_badge() -> tuple[float, float]:
    """Donde la diagonal del pliegue B se sale del badge."""
    sx, sy = FOLD_START
    ex, ey = FOLD_END
    lo, hi = 0.0, 1.0
    for _ in range(60):
        mid = (lo + hi) / 2.0
        if _inside_badge(sx + (ex - sx) * mid, sy + (ey - sy) * mid) < 0:
            lo = mid
        else:
            hi = mid
    t = lo
    return sx + (ex - sx) * t, sy + (ey - sy) * t


def badge_point_at_y(y: float, left: bool) -> float:
    """La x del borde del badge a la altura y."""
    dy = abs(y - CENTER) / A
    dx = (1.0 - dy ** N) ** (1.0 / N)
    return CENTER - A * dx if left else CENTER + A * dx


def _squircle_arc(from_point, to_point, samples: int = 24) -> list[tuple[float, float]]:
    """Los puntos del arco del badge entre dos puntos, en el sentido horario."""
    points = squircle_points(360)
    best_from = min(
        range(len(points)),
        key=lambda i: (points[i][0] - from_point[0]) ** 2 + (points[i][1] - from_point[1]) ** 2,
    )
    best_to = min(
        range(len(points)),
        key=lambda i: (points[i][0] - to_point[0]) ** 2 + (points[i][1] - to_point[1]) ** 2,
    )
    arc = []
    index = best_from
    step = 1 if (best_to - best_from) % len(points) < len(points) / 2 else -1
    while True:
        arc.append(points[index])
        if index == best_to:
            break
        index = (index + step) % len(points)
    if len(arc) > samples:
        keep = max(2, samples)
        arc = [arc[round(i * (len(arc) - 1) / (keep - 1))] for i in range(keep)]
    return arc


def facet_b_dark_path() -> str:
    """El teal oscuro: la vuelta de cinta a la izquierda del pliegue."""
    end = fold_end_on_badge()
    corner = (badge_point_at_y(FOLD_START[1], left=True), FOLD_START[1])
    polygon = [FOLD_START, end]
    polygon.extend(_squircle_arc(end, corner))
    polygon.append(corner)
    return polygon_path(polygon)


def fold_normal() -> tuple[float, float]:
    """La normal del pliegue que apunta hacia el interior del badge."""
    sx, sy = FOLD_START
    ex, ey = FOLD_END
    dx, dy = ex - sx, ey - sy
    length = math.hypot(dx, dy)
    dx, dy = dx / length, dy / length
    return dy, -dx  # rotada 90 grados: hacia abajo-derecha


def facet_b_band_path() -> str:
    """La banda iluminada que sigue al pliegue."""
    end = fold_end_on_badge()
    nx, ny = fold_normal()
    offset = (nx * FOLD_BAND_WIDTH, ny * FOLD_BAND_WIDTH)
    return polygon_path(
        [
            FOLD_START,
            end,
            (end[0] + offset[0], end[1] + offset[1]),
            (FOLD_START[0] + offset[0], FOLD_START[1] + offset[1]),
        ]
    )
