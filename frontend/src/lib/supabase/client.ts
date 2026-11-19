// =============================================================================
// The Supabase client for Storage and Realtime.
// -----------------------------------------------------------------------------
// Storage and Realtime stay on Supabase: their RLS policies and their
// realtime infrastructure are not worth reimplementing.
//
// Their policies call `auth.uid()`, and Supabase Auth is gone. The
// bridge is a short-lived token the backend mints, whose `sub` is the
// caller's id: `POST /v1/auth/supabase-token`. With that token, every
// storage and realtime policy works exactly as written.
//
// The token is not an authentication token. The API does not accept it,
// and it lasts an hour.
//
// This module is the only place that talks to Supabase from the
// browser.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { fetchSupabaseToken } from "@/lib/auth/browser";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

let client: SupabaseClient | null = null;
let tokenPromise: Promise<string | null> | null = null;

/** The Supabase client, with the publishable key. */
export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error(
        "Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your .env.",
      );
    }
    client = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

/**
 * The short-lived token for Storage and Realtime.
 *
 * It is fetched once and reused until it expires. The token lives in
 * memory only: it is not a credential the user has to keep.
 */
export async function getSupabaseToken(): Promise<string | null> {
  if (!tokenPromise) {
    tokenPromise = fetchSupabaseToken().catch(() => null);
  }
  const token = await tokenPromise;
  if (!token) {
    // The token is missing or expired; ask for a new one next time.
    tokenPromise = null;
  }
  return token;
}

/** Forget the cached token, so the next call asks for a new one. */
export function invalidateSupabaseToken(): void {
  tokenPromise = null;
}

/**
 * The headers a Storage request needs.
 *
 * The storage REST API reads the Authorization header, so the token
 * goes there rather than through the client's session.
 */
export async function storageAuthHeaders(): Promise<Record<string, string>> {
  const token = await getSupabaseToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
