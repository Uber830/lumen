// =============================================================================
// Where a signed-in user belongs.
// -----------------------------------------------------------------------------
// Two things live here: the home of each role and the validation of
// the `next` parameter of the login.
// =============================================================================

import type { SessionInfo } from "@/lib/api/types";

/** Where each role lands after signing in. */
export function destinationForSession(session: SessionInfo): string {
  if (session.platform_role === "platform_admin") return "/super";
  const roles = new Set(session.memberships.map((m) => m.role));
  if (roles.has("school_admin")) return "/admin";
  if (roles.has("teacher")) return "/docente";
  if (roles.has("student")) return "/estudiante";
  return "/";
}

/**
 * The `next` parameter, if it is a route of this site.
 *
 * An absolute URL would turn the login into an open redirect: the
 * attacker sends the victim to a page that looks like Lumen and steals
 * the credentials typed there.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  if (next.includes("\\")) return null;
  return next;
}

/** A format check, so an obvious typo does not reach the API. */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
