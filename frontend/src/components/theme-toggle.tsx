// =============================================================================
// Theme toggle: Sistema / Claro / Oscuro, per user.
// -----------------------------------------------------------------------------
// A small header control that cycles through the three preferences and
// persists the choice. The actual class toggling lives in lib/theme.ts;
// this component only owns the UI state and keeps "system" in sync with
// the OS while it is the active choice.
// =============================================================================

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";

import {
  applyTheme,
  getServerTheme,
  getStoredTheme,
  setTheme,
  subscribeTheme,
  type ThemePreference,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const ORDER: ThemePreference[] = ["system", "light", "dark"];
const LABEL: Record<ThemePreference, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Oscuro",
};
const ICON = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} as const;

export function ThemeToggle({ variant = "icon" }: { variant?: "icon" | "menu" | "icon-only" }) {
  // The preference lives in the browser. `useSyncExternalStore` asks
  // the server for its snapshot while hydrating ("system"), so the
  // markup matches what the server sent and React does not report a
  // hydration mismatch. Right after, the client settles on the stored
  // preference and the icon changes.
  //
  // There is no flash of the wrong theme: the inline head script
  // already applied the matching class before the first paint.
  const pref = useSyncExternalStore(subscribeTheme, getStoredTheme, getServerTheme);

  // While "system" is active, follow OS changes live.
  useEffect(() => {
    if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
    setTheme(next);
  }

  const Icon = ICON[pref];

  // The "menu" variant is the row at the bottom of the sidebar: the
  // current theme is spelled out, so the icon is not the only hint.
  if (variant === "menu") {
    return (
      <button
        type="button"
        onClick={cycle}
        aria-label={`Tema: ${LABEL[pref]}. Tocá para cambiar.`}
        title={`Tema: ${LABEL[pref]}`}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon
          className="size-4.5 shrink-0"
          strokeWidth={1.75}
          aria-hidden
          suppressHydrationWarning
        />
        <span className="flex-1 text-left">Tema</span>
        <span className="text-xs text-sidebar-foreground/60" suppressHydrationWarning>
          {LABEL[pref]}
        </span>
      </button>
    );
  }

  // The "icon-only" variant is the button of the folded sidebar: there is
  // no room for the label, so the icon and the title carry the meaning.
  if (variant === "icon-only") {
    return (
      <button
        type="button"
        onClick={cycle}
        aria-label={`Tema: ${LABEL[pref]}. Tocá para cambiar.`}
        title={`Tema: ${LABEL[pref]}`}
        className="grid size-9 place-items-center rounded-lg text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Icon
          className="size-4.5 shrink-0"
          strokeWidth={1.75}
          aria-hidden
          suppressHydrationWarning
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Tema: ${LABEL[pref]}. Tocá para cambiar.`}
      title={`Tema: ${LABEL[pref]}`}
      className={cn(
        "grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-5" strokeWidth={1.75} aria-hidden suppressHydrationWarning />
    </button>
  );
}
