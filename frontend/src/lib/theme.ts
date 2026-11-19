// =============================================================================
// Light / dark theme, per user.
// -----------------------------------------------------------------------------
// The preference is personal, not a school setting, so it lives in the
// browser (localStorage) and never touches the backend. Three choices:
//
//   "system" — follow the OS (prefers-color-scheme), the default
//   "light"  — always light
//   "dark"   — always dark
//
// Applying the theme means toggling the `.dark` class on <html>, which
// the CSS tokens in styles.css key off (`@custom-variant dark`).
//
// To avoid a flash of the wrong theme on first paint, the same logic
// runs as a tiny inline script in the document <head> (see
// THEME_INIT_SCRIPT), before React hydrates.
// =============================================================================

export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "lumen-theme";

/** Read the stored preference, defaulting to "system". */
export function getStoredTheme(): ThemePreference {
  if (typeof localStorage === "undefined") return "system";
  const raw = localStorage.getItem(THEME_STORAGE_KEY);
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}

/** The preference the server renders: it does not know the browser's. */
export function getServerTheme(): ThemePreference {
  return "system";
}

// The subscribers of the preference. The browser store is the source
// of truth for the UI, so the toggle reads it through
// `useSyncExternalStore` instead of copying it into a state.
const listeners = new Set<() => void>();

/** Subscribe to the preference changes. Returns the unsubscribe. */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyThemeChange(): void {
  for (const listener of listeners) listener();
}

/** Does the OS currently prefer dark? */
export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The actual light/dark the preference resolves to right now. */
export function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

/** Toggle the `.dark` class on <html> to match the preference. */
export function applyTheme(pref: ThemePreference): void {
  if (typeof document === "undefined") return;
  const dark = resolveTheme(pref) === "dark";
  document.documentElement.classList.toggle("dark", dark);
}

/** Persist and apply a new preference. */
export function setTheme(pref: ThemePreference): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  }
  applyTheme(pref);
  notifyThemeChange();
}

// The script injected into <head> to set the theme before first paint.
// Kept dependency-free and defensive (wrapped in try/catch) because it
// runs inline, before the bundle loads.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var k = ${JSON.stringify(THEME_STORAGE_KEY)};
    var p = localStorage.getItem(k) || "system";
    var dark = p === "dark" || (p === "system" &&
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", !!dark);
  } catch (e) {}
})();
`;
