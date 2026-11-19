// =============================================================================
// The profile photo.
// -----------------------------------------------------------------------------
// The image is sent to the backend (multipart), which uploads it to the
// Supabase `avatars` bucket with the service-role key and records the
// public URL on the caller's profile.
//
// Why through the backend: newer Supabase projects sign JWTs with
// asymmetric keys (ES256), so the backend cannot mint an HS256 token
// that Storage will verify for a browser-direct upload. Routing the
// upload through the backend sidesteps that and keeps the service key
// off the browser.
// =============================================================================

import { apiBaseUrl } from "@/lib/api/client";

const MAX_BYTES = 5 * 1024 * 1024; // mirrors the bucket's file_size_limit.
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);

export class AvatarUploadError extends Error {
  readonly kind: "validation" | "network";
  constructor(kind: "validation" | "network", message: string) {
    super(message);
    this.kind = kind;
  }
}

export type UploadAvatarResult = {
  avatarUrl: string;
};

/**
 * Upload a profile photo and persist its URL on the caller's profile.
 *
 * The file is validated client-side (quick feedback), then posted to
 * the backend, which performs the actual Storage write and returns the
 * updated session with the new avatar URL.
 */
export async function uploadAvatar(
  _userId: string,
  file: File,
  _oldAvatarUrl?: string | null,
): Promise<UploadAvatarResult> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new AvatarUploadError("validation", "Tipo de archivo no soportado. Usa PNG, JPG o WEBP.");
  }
  if (file.size > MAX_BYTES) {
    throw new AvatarUploadError("validation", "La imagen supera el limite de 5 MB.");
  }

  const form = new FormData();
  form.append("file", file, file.name);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}/v1/auth/me/avatar`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
  } catch (err) {
    throw new AvatarUploadError(
      "network",
      `No se pudo subir la imagen: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    let message = `No se pudo subir la imagen (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new AvatarUploadError("network", message);
  }

  const session = (await response.json()) as { profile?: { avatar_url?: string | null } };
  const avatarUrl = session.profile?.avatar_url ?? "";
  return { avatarUrl };
}
