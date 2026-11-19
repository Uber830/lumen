// =============================================================================
// Apply a school's primary colour to the theme at runtime.
// -----------------------------------------------------------------------------
// The design tokens live as CSS variables on :root (see styles.css).
// Overriding --primary and its derivatives on the document element
// re-themes the whole app without a rebuild. The colour is an oklch()
// string, the same format the palette and the base tokens use.
// =============================================================================

/** The CSS variables driven by the primary colour. */
const PRIMARY_VARS = ["--primary", "--ring", "--sidebar-ring", "--sidebar-primary"] as const;

/**
 * Apply (or clear) the school's primary colour.
 *
 * Pass null to restore the stylesheet default (removes the inline
 * overrides). A "soft" tint for --primary-soft is derived by lowering
 * the chroma and raising the lightness of the given oklch colour.
 */
export function applyPrimaryColor(color: string | null): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (!color) {
    for (const v of PRIMARY_VARS) root.style.removeProperty(v);
    root.style.removeProperty("--primary-soft");
    return;
  }

  for (const v of PRIMARY_VARS) root.style.setProperty(v, color);

  const soft = softVariant(color);
  if (soft) root.style.setProperty("--primary-soft", soft);
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
  const withSoft = soft ? `${declarations} --primary-soft: ${soft};` : declarations;
  return `html:root { ${withSoft} }`;
}

/**
 * Derive a soft tint from an oklch(L C H) string: push lightness up
 * and chroma down. Returns null when the string is not parseable, so
 * the base --primary-soft stays in effect.
 */
function softVariant(color: string): string | null {
  const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i.exec(color);
  if (!match) return null;
  const chroma = Number(match[2]);
  const hue = match[3];
  return `oklch(0.95 ${(chroma * 0.18).toFixed(3)} ${hue})`;
}
