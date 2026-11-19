// =============================================================================
// The sidebar's collapsed state, per user.
// -----------------------------------------------------------------------------
// A personal preference, like the theme: it lives in the browser and never
// touches the backend. The sidebar can be folded into a narrow strip of
// icons to leave more room for the content.
//
// The state is read through `useSyncExternalStore` so the server and the
// first client render agree: the server always draws the expanded sidebar,
// and the browser settles on the stored one right after the hydration.
// =============================================================================

export const SIDEBAR_STORAGE_KEY = "lumen-sidebar-collapsed";

/** Read the stored state, defaulting to the expanded sidebar. */
export function getStoredSidebarCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
}

/** The state the server renders: it does not know the browser's. */
export function getServerSidebarCollapsed(): boolean {
  return false;
}

// The subscribers of the state. The browser store is the source of truth
// for the UI, so the button reads it instead of copying it into a state.
const listeners = new Set<() => void>();

/** Subscribe to the state changes. Returns the unsubscribe. */
export function subscribeSidebar(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifySidebarChange(): void {
  for (const listener of listeners) listener();
}

/** Persist a new state. */
export function setSidebarCollapsed(collapsed: boolean): void {
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }
  notifySidebarChange();
}
