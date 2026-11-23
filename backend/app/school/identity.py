"""The visible identity of the school: its name, its shield and its
primary colour.

The identity is what the school sees of itself in the panel: the name
in the rail, the shield next to it and the colour of the buttons. The
platform does not write here: the school changes its own identity.

The colour is **validated in the backend, not only in the browser**.
A colour that is too close to the background makes the whole panel of
that school unreadable, and a colour saved through a shortcut is an
accessibility problem for everybody who enters it. The backend
calculates the WCAG ratio of the colour against the background and the
surface, returns it, and refuses to save a colour that is below 4.5:1.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.db.models import School

# The colours of the panel, as the stylesheet declares them. The
# contrast is checked against the two surfaces the accent sits on: the
# paper of the panel and the white of the cards and of the text that
# rides on the buttons.
#
# The panel is light by default, so a colour that reads well on it is
# one that also keeps the white text of the buttons legible.
PANEL_BACKGROUND = "#FCFCFD"
PANEL_SURFACE = "#FFFFFF"

# The minimum ratio a text colour needs to be readable (WCAG 2.1 AA).
MINIMUM_CONTRAST = 4.5

# The shield of the school: PNG, SVG or JPEG, and no more than 2 MB.
MAX_LOGO_BYTES = 2 * 1024 * 1024
LOGO_MIME_TYPES = {
    "image/png": ".png",
    "image/svg+xml": ".svg",
    "image/jpeg": ".jpg",
}

# The magic bytes of the formats that are accepted. The extension of
# the file says nothing: the type is read from the content.
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
JPEG_SIGNATURE = b"\xff\xd8\xff"


def relative_luminance(color: str) -> float:
    """The relative luminance of a colour, as WCAG 2.1 defines it.

    The colour is a `#rrggbb` hex. The channels are linearised first:
    a sRGB value below 0.03928 is divided by twelve, and the rest is
    raised to the power of 2.4.
    """
    channels = _channels(color)
    linear = [
        channel / 12.92 if channel <= 0.03928 else ((channel + 0.055) / 1.055) ** 2.4
        for channel in channels
    ]
    red, green, blue = linear
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue


def contrast_ratio(color: str, background: str) -> float:
    """The contrast ratio between two colours, from 1 to 21."""
    first = relative_luminance(color)
    second = relative_luminance(background)
    lighter, darker = max(first, second), min(first, second)
    return (lighter + 0.05) / (darker + 0.05)


def _channels(color: str) -> list[float]:
    """The three channels of a hex colour, from 0 to 1."""
    value = color.strip().lstrip("#")
    if len(value) == 3:
        value = "".join(character * 2 for character in value)
    if len(value) != 6:
        raise ValueError(f"Not a hex colour: {color}")
    try:
        return [int(value[index : index + 2], 16) / 255 for index in (0, 2, 4)]
    except ValueError as error:
        raise ValueError(f"Not a hex colour: {color}") from error


def check_contrast(color: str) -> dict[str, float]:
    """The contrast of a colour against the panel, and whether it passes.

    The two surfaces are checked: the background of the panel and the
    surface of the cards. A colour that reads well on one and not on
    the other is not a colour of the panel.
    """
    background_ratio = contrast_ratio(color, PANEL_BACKGROUND)
    surface_ratio = contrast_ratio(color, PANEL_SURFACE)
    return {
        "background_ratio": round(background_ratio, 2),
        "surface_ratio": round(surface_ratio, 2),
        "min_ratio": round(min(background_ratio, surface_ratio), 2),
        "minimum": MINIMUM_CONTRAST,
    }


def validate_primary_color(color: str) -> dict[str, float]:
    """Check a colour and refuse the ones the panel cannot read.

    The refusal carries the ratio: the person administering the school
    sees why the colour was not saved, and how far it is from the
    minimum.
    """
    try:
        contrast = check_contrast(color)
    except ValueError as error:
        raise ValidationError(
            "No se puede guardar",
            code="invalid_color",
            extra={"fields": {"primary_color": "El color no es un hexadecimal válido."}},
        ) from error

    if contrast["min_ratio"] < MINIMUM_CONTRAST:
        raise ValidationError(
            "No se puede guardar",
            code="low_contrast",
            extra={
                "fields": {
                    "primary_color": (
                        f"Contraste {contrast['min_ratio']}:1. "
                        f"Se requiere {MINIMUM_CONTRAST}:1 o más."
                    )
                },
                "contrast": contrast,
            },
        )

    return contrast


def validate_logo(content: bytes, content_type: str) -> str:
    """Check the shield of the school and return its mime type.

    The type is read from the content, not from what the browser says:
    a file called `escudo.png` that is really a script is not a shield.
    """
    if not content:
        raise ValidationError(
            "No se puede guardar",
            code="empty_file",
            extra={"fields": {"logo": "El archivo está vacío."}},
        )

    if len(content) > MAX_LOGO_BYTES:
        raise ValidationError(
            "No se puede guardar",
            code="file_too_large",
            extra={"fields": {"logo": "El escudo pesa más de 2 MB. Elige uno más liviano."}},
        )

    if content.startswith(PNG_SIGNATURE):
        return "image/png"

    if content.startswith(JPEG_SIGNATURE):
        return "image/jpeg"

    # An SVG is text: it has to say that it is an SVG.
    head = content[:512].lstrip()
    if head.startswith(b"<?xml") or head.startswith(b"<svg") or b"<svg" in head:
        return "image/svg+xml"

    raise ValidationError(
        "No se puede guardar",
        code="invalid_file",
        extra={"fields": {"logo": "El escudo debe ser un archivo PNG, SVG o JPEG."}},
    )


async def get_identity(session: AsyncSession, school_id: uuid.UUID) -> dict[str, Any]:
    """The visible identity of the school, with the contrast of its colour."""
    school = await session.get(School, school_id)
    if school is None:
        return {}

    primary_color = school.primary_color
    contrast = check_contrast(primary_color) if primary_color else None

    return {
        "display_name": school.display_name or school.name,
        "name": school.name,
        "logo_url": school.logo_url,
        "primary_color": primary_color,
        "contrast": contrast,
    }


async def set_logo(
    session: AsyncSession,
    school_id: uuid.UUID,
    logo_url: str,
) -> None:
    """Save the shield of the school."""
    school = await session.get(School, school_id)
    if school is None:
        raise ValidationError("El colegio no existe.")
    school.logo_url = logo_url
    await session.commit()


async def update_identity(
    session: AsyncSession,
    school_id: uuid.UUID,
    *,
    display_name: str | None = None,
    primary_color: str | None = None,
) -> dict[str, Any]:
    """Change the identity of the school.

    The colour is validated before it is written: a colour that is too
    close to the background is refused, with its ratio.
    """
    school = await session.get(School, school_id)
    if school is None:
        raise ValidationError("El colegio no existe.")

    if display_name is not None:
        name = display_name.strip()
        if not name:
            raise ValidationError(
                "No se puede guardar",
                code="invalid_name",
                extra={"fields": {"display_name": "El nombre visible no puede estar vacío."}},
            )
        school.display_name = name

    if primary_color is not None:
        validate_primary_color(primary_color)
        school.primary_color = primary_color

    await session.commit()
    return await get_identity(session, school_id)


__all__ = [
    "LOGO_MIME_TYPES",
    "MAX_LOGO_BYTES",
    "MINIMUM_CONTRAST",
    "PANEL_BACKGROUND",
    "PANEL_SURFACE",
    "check_contrast",
    "contrast_ratio",
    "get_identity",
    "set_logo",
    "relative_luminance",
    "update_identity",
    "validate_logo",
    "validate_primary_color",
]
