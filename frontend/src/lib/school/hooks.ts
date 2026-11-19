// =============================================================================
// The school profile hooks: read and update the school's branding.
// -----------------------------------------------------------------------------
// Backs the admin "Personalización" view and the app-shell brand. The
// school is always the caller's own (the backend resolves it from the
// session); the id is only used as a React Query cache key.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api, apiBaseUrl } from "@/lib/api/client";
import type { School, SchoolUpdateInput } from "@/lib/school/types";

export type { School, SchoolUpdateInput };

export const schoolKeys = {
  me: (schoolId: string | null) => ["school", schoolId ?? "none"] as const,
};

/** The caller's school, including its branding. */
export function useSchool(schoolId: string | null): UseQueryResult<School, Error> {
  return useQuery({
    queryKey: schoolKeys.me(schoolId),
    enabled: !!schoolId,
    queryFn: () => api.get<School>("/v1/schools/me"),
  });
}

/** Update the school's branding (admin only). */
export function useUpdateSchool(
  schoolId: string | null,
): UseMutationResult<School, Error, SchoolUpdateInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.patch<School>("/v1/schools/me", input),
    onSuccess: (school) => {
      qc.setQueryData(schoolKeys.me(schoolId), school);
      qc.invalidateQueries({ queryKey: schoolKeys.me(schoolId) });
    },
  });
}

export class LogoUploadError extends Error {}

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const ALLOWED_LOGO_MIME = new Set(["image/png", "image/jpeg", "image/svg+xml"]);

/**
 * Upload the school logo through the backend (which writes it to the
 * school-logos bucket with the service-role key) and return the
 * updated school.
 */
export async function uploadSchoolLogo(file: File): Promise<School> {
  return uploadImage("/v1/schools/me/logo", file);
}

async function uploadImage(path: string, file: File): Promise<School> {
  if (!ALLOWED_LOGO_MIME.has(file.type)) {
    throw new LogoUploadError("Tipo de archivo no soportado. Usa PNG, JPG o SVG.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new LogoUploadError("El logo supera el límite de 5 MB.");
  }

  const form = new FormData();
  form.append("file", file, file.name);

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
  } catch (err) {
    throw new LogoUploadError(
      `No se pudo subir la imagen: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    let message = `No se pudo subir la imagen (${response.status}).`;
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === "string") message = body.detail;
    } catch {
      // keep generic message
    }
    throw new LogoUploadError(message);
  }

  return (await response.json()) as School;
}
