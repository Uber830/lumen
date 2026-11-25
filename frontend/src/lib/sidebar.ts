// =============================================================================
// The state of the left rail: expanded or collapsed.
// -----------------------------------------------------------------------------
// The preference is personal, not a school setting, so it lives in the
// browser (localStorage) and never touches the backend, the same way the
// theme does.
//
// The rail of the desktop has two shapes:
//
//   expanded   the labels are shown and the rail is 270 px wide
//   collapsed  the rail is a strip of icons, 68 px wide
//
// The store is the source of truth for the UI: the shell reads it with
// `useCollapsedSidebar`, so every view of the app shares the same shape.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useState } from "react";

/**
 * The effect that runs before the paint in the browser and after it in
 * the server: the server has no browser to paint.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export const SIDEBAR_STORAGE_KEY = "lumen-sidebar-collapsed";

/** Is the rail collapsed? It is expanded by default. */
export function getCollapsedSidebar(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
  } catch {
    // A browser that blocks the storage keeps the rail expanded.
    return false;
  }
}

// The subscribers of the preference.
const listeners = new Set<() => void>();

/** Subscribe to the changes of the rail. Returns the unsubscribe. */
export function subscribeSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySidebarChange(): void {
  for (const listener of listeners) listener();
}

/** Persist the new shape of the rail. */
export function setCollapsedSidebar(collapsed: boolean): void {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // The rail still changes for this session, it is just not remembered.
    }
  }
  notifySidebarChange();
}

/**
 * The shape of the rail, as the interface sees it.
 *
 * The preference lives in the browser and the server does not know it:
 * the server always sends the rail expanded. Reading the stored value
 * during the render would make the client and the server disagree, and
 * React does not patch the attributes that do not match — the rail
 * would stay expanded even with the preference saved.
 *
 * So the value is read once the component is mounted: the first paint
 * is the one the server sent and the rail folds right after, before
 * the browser shows the frame.
 */
export function useCollapsedSidebar(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useIsomorphicLayoutEffect(() => {
    setCollapsed(getCollapsedSidebar());
    return subscribeSidebar(() => setCollapsed(getCollapsedSidebar()));
  }, []);

  const change = useCallback((next: boolean) => {
    setCollapsedSidebar(next);
  }, []);

  return [collapsed, change];
}
