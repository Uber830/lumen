// =============================================================================
// Where the floating things of the panel live.
// -----------------------------------------------------------------------------
// The dialog, the drawer and the dropdown of the panel are drawn in a
// portal: by default that portal is the `body`, which lives outside the
// scope of the panel (`.lumen-panel`). There the type is the one of the
// site, the radius is not the square one of El Índice and the colours
// are the generic ones.
//
// The container of the portal is therefore the panel itself: the modal
// speaks the same language as the page it opens over.
// =============================================================================

/**
 * The element of the panel, or nothing when there is no panel (the
 * public site): the portal then falls back to the `body`.
 */
export function panelContainer(): HTMLElement | undefined {
  if (typeof document === "undefined") return undefined;
  return document.querySelector<HTMLElement>(".lumen-panel") ?? undefined;
}
