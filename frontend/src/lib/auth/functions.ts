// =============================================================================
// The session, on the server.
// -----------------------------------------------------------------------------
// The session lives in an httpOnly cookie that the backend sets. The
// server functions read the cookie from the incoming request and
// forward it to the API as an `Authorization: Bearer` header.
//
// The browser never sees the access token: the page's JavaScript
// cannot read an httpOnly cookie, so an XSS cannot steal it. The
// browser's own calls to the API send the cookie automatically with
// `credentials: "include"`.
//
// Signing in and out happen in the browser (see `lib/auth/browser.ts`):
// the API's cookie has to land on the browser, not on this server.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";

import { apiAs } from "@/lib/api/client";
import type { SessionInfo } from "@/lib/api/types";
import { readAccessToken } from "@/lib/auth/cookies.server";
import type { SchoolBranding } from "@/lib/school/types";

/**
 * The signed-in state, in the shape the components use.
 *
 * The API returns snake_case; the components have always used
 * camelCase. The conversion happens here, once, so the UI did not
 * have to be touched.
 */
export type SessionContext = {
  user: {
    id: string;
    email: string | null;
  };
  profile: {
    id: string;
    full_name: string;
    given_name: string | null;
    family_name: string | null;
    phone: string | null;
    locale: string;
    avatar_url: string | null;
  } | null;
  memberships: {
    id: string;
    school_id: string;
    role: "school_admin" | "teacher" | "student";
    is_primary: boolean;
    joined_at: string;
  }[];
  platformRole: "platform_admin" | null;
  primarySchoolId: string | null;
  /** The academic period the school is in, shown in the top bar. */
  currentPeriod: string | null;
  /**
   * The permissions of the caller in the school. The frontend does not
   * decide what the rank may do: it receives the list from the API and
   * disables the action that is not on it, with the reason.
   */
  permissions: string[];
  /**
   * The branding of the primary school.
   *
   * It comes with the session so the server already knows the school's
   * colour and logo when it renders the page: the app does not paint
   * itself with the default theme and repaint a second later.
   */
  school: SchoolBranding | null;
};

/** Turn the API's session into the shape the components use. */
function toSessionContext(session: SessionInfo): SessionContext {
  return {
    user: session.user,
    profile: session.profile,
    memberships: session.memberships,
    platformRole: session.platform_role,
    primarySchoolId: session.primary_school_id,
    currentPeriod: session.current_period ?? null,
    permissions: session.permissions ?? [],
    school: session.school ?? null,
  };
}

/**
 * The signed-in session, or null.
 *
 * The frontend calls this on every page load to rebuild the signed-in
 * state: the profile, the memberships and the platform role.
 */
export const getCurrentSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionContext | null> => {
    const token = readAccessToken();
    if (!token) return null;

    try {
      const session = await apiAs.get<SessionInfo>("/v1/auth/me", token);
      return toSessionContext(session);
    } catch {
      // The token expired or was revoked. The browser refreshes on the
      // next request; here we simply report "not signed in".
      return null;
    }
  },
);

/**
 * Update the avatar URL of the signed-in user.
 *
 * The file itself is uploaded to Supabase Storage from the browser
 * (see `lib/storage/files.ts`); this only records the resulting URL.
 */
export const updateAvatar = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null) {
      throw new Error("avatarUrl must be an object");
    }
    const v = (input as { avatarUrl?: unknown }).avatarUrl;
    if (v !== undefined && v !== null && typeof v !== "string") {
      throw new Error("avatarUrl must be a string or null");
    }
    return { avatarUrl: typeof v === "string" ? v : null };
  })
  .handler(async ({ data }): Promise<{ avatarUrl: string | null }> => {
    const token = readAccessToken();
    if (!token) {
      throw new Error("No hay sesion activa.");
    }

    const updated = await apiAs.patch<SessionInfo>("/v1/auth/me", token, {
      avatar_url: data.avatarUrl,
    });
    return { avatarUrl: updated.profile?.avatar_url ?? null };
  });

/**
 * Update the personal data of the signed-in user.
 *
 * Accepts any subset of { full_name, family_name, phone, email }.
 * Only the fields explicitly provided are written. Changing the email
 * to one already in use surfaces as a 409 from the API.
 */
export const updateProfile = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (typeof input !== "object" || input === null) {
      throw new Error("payload must be an object");
    }
    const obj = input as {
      full_name?: unknown;
      family_name?: unknown;
      phone?: unknown;
      email?: unknown;
    };
    const out: {
      full_name?: string | null;
      family_name?: string | null;
      phone?: string | null;
      email?: string;
    } = {};

    for (const key of ["full_name", "family_name", "phone"] as const) {
      const v = obj[key];
      if (v !== undefined) {
        if (v !== null && typeof v !== "string") {
          throw new Error(`${key} must be a string or null`);
        }
        const trimmed = typeof v === "string" ? v.trim() : null;
        out[key] = trimmed && trimmed.length > 0 ? trimmed : null;
      }
    }
    if (obj.email !== undefined) {
      if (typeof obj.email !== "string" || obj.email.trim().length === 0) {
        throw new Error("email must be a non-empty string");
      }
      out.email = obj.email.trim();
    }
    return out;
  })
  .handler(
    async ({
      data,
    }): Promise<{
      full_name: string | null;
      family_name: string | null;
      phone: string | null;
      email: string | null;
    }> => {
      const token = readAccessToken();
      if (!token) {
        throw new Error("No hay sesion activa.");
      }

      const updated = await apiAs.patch<SessionInfo>("/v1/auth/me", token, data);
      return {
        full_name: updated.profile?.full_name ?? null,
        family_name: updated.profile?.family_name ?? null,
        phone: updated.profile?.phone ?? null,
        email: updated.user?.email ?? null,
      };
    },
  );

export type { SessionInfo };
