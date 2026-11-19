// =============================================================================
// Signing in and out, from the browser.
// -----------------------------------------------------------------------------
// These calls have to run in the browser, not on the server: the API
// sets the session cookies, and the browser is where they have to
// land. The frontend's server then reads them during SSR.
//
// The tokens are never stored in JavaScript. They live in httpOnly
// cookies, so the page cannot read them and an XSS cannot steal them.
// =============================================================================

import { api, ApiError } from "@/lib/api/client";
import type { AuthResponse, SessionInfo } from "@/lib/api/types";

export type SignInInput = {
  email: string;
  password: string;
  /**
   * Keep the session in this browser. It does not make the refresh
   * token last longer: the browser just does not forget it when it
   * closes.
   */
  remember_me?: boolean;
};

export type RegisterInput = {
  email: string;
  password: string;
  full_name: string;
};

/**
 * Sign in.
 *
 * On success the API has set the session cookies. The returned
 * session is what the app renders with.
 */
export async function signIn(input: SignInInput): Promise<SessionInfo> {
  try {
    const response = await api.post<AuthResponse>("/v1/auth/login", input);
    return response.session;
  } catch (error) {
    throw new Error(authErrorMessage(error, "No se pudo iniciar sesion."), {
      cause: error,
    });
  }
}

/**
 * Create an account and sign in.
 *
 * The account starts unverified; the backend sends the verification
 * email when an email provider is configured.
 */
export async function register(input: RegisterInput): Promise<SessionInfo> {
  try {
    const response = await api.post<AuthResponse>("/v1/auth/register", input);
    return response.session;
  } catch (error) {
    throw new Error(authErrorMessage(error, "No se pudo crear la cuenta."), {
      cause: error,
    });
  }
}

/**
 * Sign out.
 *
 * The backend revokes the refresh token and clears the cookies. The
 * call is best-effort: if it fails, the cookies are cleared anyway
 * so the user is signed out locally.
 */
export async function signOut(): Promise<void> {
  try {
    await api.post("/v1/auth/logout", { refresh_token: "" });
  } catch {
    // The session was already over.
  }
}

/**
 * The short-lived token the browser needs for Supabase Storage and
 * Realtime.
 *
 * Storage and Realtime stay on Supabase, and their RLS policies call
 * `auth.uid()`. The backend mints a token whose `sub` is the
 * caller's id, so those policies work unchanged. It is not an
 * authentication token: the API does not accept it.
 */
export async function fetchSupabaseToken(): Promise<string | null> {
  try {
    const response = await api.get<{ token: string | null }>("/v1/auth/supabase-token");
    return response.token;
  } catch {
    // Storage and Realtime are unavailable; the rest works.
    return null;
  }
}

/**
 * Activate an invited account, or reset a password.
 *
 * An admin creates a user with no password and hands them an
 * activation link carrying this token. Redeeming it sets the first
 * password through the same endpoint the password-reset flow uses.
 */
export async function activateAccount(input: { token: string; password: string }): Promise<void> {
  try {
    await api.post("/v1/auth/reset-password", {
      token: input.token,
      password: input.password,
    });
  } catch (error) {
    throw new Error(authErrorMessage(error, "No se pudo activar la cuenta."), {
      cause: error,
    });
  }
}

/** Turn an API error into a message the user can act on. */
function authErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Correo o contrasena incorrectos.";
    if (error.status === 409) return "Ya existe una cuenta con ese correo.";
    if (error.status === 429) {
      return "Demasiados intentos. Espera unos minutos antes de volver a intentar.";
    }
    return error.message || fallback;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
