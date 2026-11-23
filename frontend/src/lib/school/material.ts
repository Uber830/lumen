// =============================================================================
// The material enabled for the school.
// -----------------------------------------------------------------------------
// The admin of a school consumes the material: it queries the piece
// that the platform team enabled for its school. The material lives
// inside the platform and nobody downloads the file. The admin never
// uploads, never publishes and never decides who sees what.
//
// The list is filtered and paginated in the server: the catalog of the
// platform does not travel to the browser to be filtered there.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** One course of the school a material applies to. */
export type MaterialCourse = {
  id: string;
  name: string;
};

/** One piece of the enabled material. */
export type MaterialListItem = {
  id: string;
  /** The short code shown in the table: C-1041. */
  ref: string;
  title: string;
  description: string | null;
  area: string;
  kind: string;
  file_size_bytes: number | null;
  /** When the platform enabled it for this school. */
  available_since: string;
  courses: MaterialCourse[];
};

/** The access of the school to a material, confirmed. */
export type MaterialAccess = {
  confirmed: boolean;
  enabled_at: string;
  note: string;
};

/** One material, with its access confirmed. */
export type MaterialDetail = MaterialListItem & { access: MaterialAccess };

/** A page of the material of the school. */
export type MaterialPage = {
  items: MaterialListItem[];
  /** How many materials the filters leave. */
  total: number;
  /** How much material the school has, with no filters. */
  available_total: number;
  page: number;
  per_page: number;
  pages: number;
  /** The areas the school can filter by. */
  areas: string[];
};

/** The filters of the list, as the URL sends them. */
export type MaterialFilters = {
  q?: string;
  area?: string;
  page?: number;
};

export const materialKeys = {
  list: (filters: MaterialFilters) => ["school", "material", filters] as const,
  detail: (id: string) => ["school", "material", "detail", id] as const,
};

/** The material of the school, filtered and paginated in the server. */
export function useSchoolMaterial(filters: MaterialFilters): UseQueryResult<MaterialPage, Error> {
  return useQuery({
    queryKey: materialKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.area && filters.area !== "all") params.set("area", filters.area);
      params.set("page", String(filters.page ?? 1));
      params.set("per_page", "6");
      return api.get<MaterialPage>(`/v1/school/material?${params.toString()}`);
    },
  });
}

/** One material of the school, with its access confirmed. */
export function useSchoolMaterialDetail(id: string | null): UseQueryResult<MaterialDetail, Error> {
  return useQuery({
    queryKey: materialKeys.detail(id ?? ""),
    enabled: Boolean(id),
    queryFn: () => api.get<MaterialDetail>(`/v1/school/material/${id}`),
  });
}

/** The size of a file, in the units a person reads. */
export function formatFileSize(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const rounded = value >= 10 ? value.toFixed(0) : value.toFixed(1);
  return `${rounded.replace(".", ",")} ${units[unit]}`;
}

/** A date, the way the panel writes them: 14/11/2026. */
export function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}
