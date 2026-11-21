// =============================================================================
// The visible identity of the school.
// -----------------------------------------------------------------------------
// The name, the shield and the primary colour. The school changes its own
// identity; the platform does not write here.
//
// The colour is validated in the backend: it returns the WCAG ratio of
// the colour against the background and the surface of the panel, and
// refuses to save a colour below 4.5:1. The interface shows the ratio
// and the reason of the refusal.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** The contrast of the primary colour, calculated by the backend. */
export type ColorContrast = {
  background_ratio: number;
  surface_ratio: number;
  min_ratio: number;
  minimum: number;
};

/** The visible identity of the school. */
export type SchoolIdentity = {
  display_name: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  contrast: ColorContrast | null;
};

/**
 * The samples of the mockup. Every one of them passes the contrast
 * check against the dark panel: the backend calculates it, and this
 * list is the one the panel offers.
 */
export const COLOR_SAMPLES = [
  { name: "Azul", value: "#2E8FFF" },
  { name: "Verde", value: "#2BD98A" },
  { name: "Rojo", value: "#F05D5E" },
  { name: "Turquesa", value: "#2DD4BF" },
  { name: "Ámbar", value: "#F5A524" },
] as const;

export const identityKeys = {
  settings: () => ["school", "settings"] as const,
};

/** The identity of the school, with the contrast of its colour. */
export function useSchoolIdentity(): UseQueryResult<SchoolIdentity, Error> {
  return useQuery({
    queryKey: identityKeys.settings(),
    queryFn: () => api.get<SchoolIdentity>("/v1/school/settings"),
  });
}

/**
 * Save the name and the colour.
 *
 * The backend refuses a colour with a low contrast and answers with
 * the fields that failed, so the message reaches the right control.
 */
export function useUpdateSchoolIdentity(): UseMutationResult<
  SchoolIdentity,
  Error,
  { display_name?: string; primary_color?: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch) => api.patch<SchoolIdentity>("/v1/school/settings", patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: identityKeys.settings() });
    },
  });
}

/**
 * Upload the shield of the school.
 *
 * The file is sent as it is: the backend reads the type from the
 * content and refuses what is not a PNG, an SVG or a JPEG.
 */
export function useUploadSchoolLogo(): UseMutationResult<SchoolIdentity, Error, File> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      const response = await fetch(`${apiBaseUrl()}/v1/school/logo`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        let detail = `No se pudo subir el escudo (${response.status}).`;
        try {
          const body = await response.json();
          detail = body?.fields?.logo ?? body?.detail ?? detail;
        } catch {
          // The answer was not JSON: the message above is enough.
        }
        throw new Error(detail);
      }
      return (await response.json()) as SchoolIdentity;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: identityKeys.settings() });
    },
  });
}

/** The base URL of the API, the same one the client uses. */
function apiBaseUrl(): string {
  return (import.meta.env.VITE_API_URL ?? "http://localhost:8010").replace(/\/$/, "");
}
