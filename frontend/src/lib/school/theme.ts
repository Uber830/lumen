// =============================================================================
// Apply a school's primary colour to the theme at runtime.
// -----------------------------------------------------------------------------
// The colour is written in `--school-primary`, a variable of the
// document root, and the panel reads it from there (see
// components/panel/panel.css): `--primary` is derived from it, so the
// accent of the school, its soft tint, the ring of the focus and the
// accent of the rail all move together.
//
// The variable lives on the document element on purpose: the panel
// scope derives `--primary` from it, and a declaration made in the
// scope would shadow the inherited value.
// =============================================================================

/** The CSS variables driven by the primary colour. */
const PRIMARY_VARS = ["--school-primary"] as const;

/**
 * Apply (or clear) the school's primary colour.
 *
 * Pass null to restore the stylesheet default (removes the inline
 * overrides). A "soft" tint for `--school-primary-soft` is derived by
 * lowering the chroma and raising the lightness of the given oklch
 * colour.
 */
export function applyPrimaryColor(color: string | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (!color) {
    for (const v of PRIMARY_VARS) root.style.removeProperty(v);
    root.style.removeProperty("--school-primary-soft");
    return;
  }

  for (const v of PRIMARY_VARS) root.style.setProperty(v, color);

  const soft = softVariant(color);
  if (soft) root.style.setProperty("--school-primary-soft", soft);
}

/**
 * The CSS rules that paint the app with the school's primary colour.
 *
 * The selector is `html:root`, not `:root`: it is more specific than
 * the `.dark` block of the stylesheet, so the school's colour wins in
 * both light and dark mode (an inline style on the element, which
 * `applyPrimaryColor` sets, wins over both).
 *
 * The server renders this inside the page, so the very first frame is
 * already in the school's colour: there is no flash of the default
 * theme while the browser fetches the school.
 */
export function primaryColorStyle(color: string | null): string {
  if (!color) return "";

  const soft = softVariant(color);
  const declarations = PRIMARY_VARS.map((v) => `${v}: ${color};`).join(" ");
  const withSoft = soft ? `${declarations} --school-primary-soft: ${soft};` : declarations;
  return `html:root { ${withSoft} }`;
}

/**
 * Derive a soft tint from the primary colour.
 *
 * The colour of a school is a hexadecimal one, and the tint is the
 * same colour mixed with the background: `color-mix` does it in the
 * browser, with whatever colour it is given. The oklch colours of the
 * base stylesheet keep their own derivation.
 */
function softVariant(color: string): string | null {
  if (/^#[0-9a-f]{3,8}$/i.test(color.trim())) {
    return `color-mix(in oklab, ${color} 14%, transparent)`;
  }

  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(color);
  if (!match) return null;
  const chroma = Number(match[2]);
  const hue = match[3];
  return `oklch(0.95 ${(chroma * 0.18).toFixed(3)} ${hue})`;
}
