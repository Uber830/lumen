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
 * check against the panel: the backend calculates it, and this list is
 * the one the panel offers.
 *
 * The panel is light, so the samples are the darker shade of each hue:
 * the accent is the background of the buttons, and the text on them is
 * white.
 */
export const COLOR_SAMPLES = [
  { name: "Azul", value: "#1A4CF0" },
  { name: "Verde", value: "#0E7A3D" },
  { name: "Rojo", value: "#B3261E" },
  { name: "Turquesa", value: "#00707A" },
  { name: "Ámbar", value: "#8A5A00" },
] as const;

/** The surfaces the accent of the school sits on. */
const PANEL_BACKGROUND = "#fcfcfd";
const PANEL_SURFACE = "#ffffff";

/** The minimum ratio a colour needs to keep the text readable (WCAG AA). */
export const MINIMUM_CONTRAST = 4.5;

/** The relative luminance of a colour, as WCAG 2.1 defines it. */
function luminance(color: string): number | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/**
 * The contrast of a colour against the panel.
 *
 * It is the same calculation the backend does, so the notice of the
 * view can talk about the colour that is being picked, not only about
 * the one that was saved. The backend still has the last word when the
 * colour is saved.
 */
export function colorContrast(color: string): {
  min_ratio: number;
  minimum: number;
  passes: boolean;
} | null {
  const foreground = luminance(color);
  if (foreground === null) return null;

  const ratios = [PANEL_BACKGROUND, PANEL_SURFACE].map((surface) => {
    const background = luminance(surface);
    if (background === null) return 1;
    const lighter = Math.max(foreground, background);
    const darker = Math.min(foreground, background);
    return (lighter + 0.05) / (darker + 0.05);
  });

  const min = Math.min(...ratios);
  return {
    min_ratio: Math.round(min * 100) / 100,
    minimum: MINIMUM_CONTRAST,
    passes: min >= MINIMUM_CONTRAST,
  };
}

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
