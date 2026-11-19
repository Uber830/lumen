// =============================================================================
// The theme control of the public site.
// -----------------------------------------------------------------------------
// The theme is a preference of the person, not of the school: it lives
// in the browser and never touches the backend. The same three choices
// the panel offers —system, light, dark— with the same storage key, so
// the choice made in one place is the choice in the other.
//
// The button is drawn like the rest of El Índice: a rectangle, a
// hairline border and a monospaced label that says what the current
// theme is. The state is in the label too, not only in the icon.
// =============================================================================

import { useEffect, useSyncExternalStore } from "react";

import {
  applyTheme,
  getServerTheme,
  getStoredTheme,
  setTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";

const ORDER: ThemePreference[] = ["system", "light", "dark"];

const LABEL: Record<ThemePreference, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};

/** The sun of the light theme, the moon of the dark one. */
function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "light") {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
        className="size-4 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="8" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.1 3.1l1.3 1.3M11.6 11.6l1.3 1.3M12.9 3.1l-1.3 1.3M4.4 11.6l-1.3 1.3"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="square"
        />
      </svg>
    );
  }

  if (preference === "dark") {
    return (
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        focusable="false"
        className="size-4 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M13.5 9.6A6 6 0 016.4 2.5a6 6 0 107.1 7.1z"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      focusable="false"
      className="size-4 shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="1.5" y="2.5" width="13" height="9" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 14h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="square" />
    </svg>
  );
}

export function SiteThemeToggle({ compact = false }: { compact?: boolean }) {
  /*
   * The preference lives in the browser. While hydrating, the server
   * answers "system", so the markup matches what the server sent and
   * React does not report a mismatch; right after, the stored
   * preference settles in.
   */
  const preference = useSyncExternalStore(subscribeTheme, getStoredTheme, getServerTheme);

  // While "system" is active, the OS changes are followed live.
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
    setTheme(next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Tema: ${LABEL[preference]}. Cambiar el tema.`}
      title={`Tema: ${LABEL[preference]}`}
      className="inline-flex items-center gap-2 rounded-idx border border-line-2 px-3 py-2 font-mono text-[12px] uppercase tracking-[0.14em] text-ink-2 transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <ThemeIcon preference={preference} />
      {compact ? null : <span suppressHydrationWarning>{LABEL[preference]}</span>}
    </button>
  );
}
