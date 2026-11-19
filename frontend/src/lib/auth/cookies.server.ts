// =============================================================================
// The session cookie, on the server.
// -----------------------------------------------------------------------------
// This module reads the access token from the incoming request. It is
// server-only: the `.server.ts` suffix keeps it out of the browser
// bundle, where the cookie does not exist anyway.
//
// The file is imported by the server functions, and only from inside
// their handlers, so it is tree-shaken out of the client bundle.
// =============================================================================

import { getCookie } from "@tanstack/react-start/server";

/** The cookie the backend sets the access token in. */
export const ACCESS_COOKIE = "lumen_access";

/** The cookie the backend sets the refresh token in. */
export const REFRESH_COOKIE = "lumen_refresh";

/**
 * The access token of the incoming request, if the user is signed in.
 *
 * Returns null outside a request context (during the build, or in a
 * background job).
 */
export function readAccessToken(): string | null {
  try {
    return getCookie(ACCESS_COOKIE) ?? null;
  } catch {
    return null;
  }
}
