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

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api, apiBaseUrl } from "@/lib/api/client";

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
  /** What the piece is: "Libro", "Guía", "Evaluación"... */
  type: string;
  kind: string;
  /** Who the piece is for: "all" or "teachers". */
  visible_to: string;
  /** "lumen" when the editorial team loaded it, "colegio" when the school did. */
  origin: string;
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

/** The file of a resource: the viewer shows it inside the platform. */
export type MaterialFile = {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  size_label: string;
};

/** One material, with its access confirmed. */
export type MaterialDetail = MaterialListItem & {
  access: MaterialAccess;
  file: MaterialFile | null;
};

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
  /** The audiences the school can filter by. */
  audiences: string[];
};

/** The filters of the list, as the URL sends them. */
export type MaterialFilters = {
  q?: string;
  area?: string;
  audience?: string;
  page?: number;
};

export const materialKeys = {
  list: (filters: MaterialFilters) => ["school", "material", filters] as const,
  detail: (id: string) => ["school", "material", "detail", id] as const,
};
/** How many resources the shelf shows at once. */
export const MATERIAL_PAGE_SIZE = 12;

/** The material of the school, filtered and paginated in the server. */
export function useSchoolMaterial(filters: MaterialFilters): UseQueryResult<MaterialPage, Error> {
  return useQuery({
    queryKey: materialKeys.list(filters),
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.area && filters.area !== "all") params.set("area", filters.area);
      if (filters.audience && filters.audience !== "all") {
        params.set("audience", filters.audience);
      }
      params.set("page", String(filters.page ?? 1));
      params.set("per_page", String(MATERIAL_PAGE_SIZE));
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

// ---------------------------------------------------------------------------
// The resources the school loads
// ---------------------------------------------------------------------------
//
// The school publishes its own guides and manuals: a manual of the
// school, a guide for the teachers, a text for the students. The file
// is uploaded first and the piece is created with it, like in the
// platform.
// ---------------------------------------------------------------------------

/** The file that was uploaded, before the piece that carries it. */
export type UploadedFile = {
  file_id: string;
  file_name: string;
  size_bytes: number;
  size_label: string;
  mime_type: string;
};

/** What the school writes when it loads a resource. */
export type CreateSchoolMaterial = {
  title: string;
  type: string;
  area: string;
  visible_to: string;
  description?: string | null;
  file_id: string;
};

/** The closed catalogs of the resources: types, areas and audiences. */
export type MaterialOptions = {
  types: string[];
  areas: string[];
  audiences: string[];
};

/** The catalogs the form of a new resource offers. */
export function useSchoolMaterialOptions(): UseQueryResult<MaterialOptions, Error> {
  return useQuery({
    queryKey: ["school", "material", "options"],
    queryFn: () => api.get<MaterialOptions>("/v1/school/material/options"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Upload the file of a resource. */
export function useUploadSchoolFile(): UseMutationResult<UploadedFile, Error, File> {
  return useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(`${apiBaseUrl}/v1/school/material/uploads`, {
        method: "POST",
        body,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("No se pudo subir el archivo.");
      }
      return (await response.json()) as UploadedFile;
    },
  });
}

/** Create a resource of the school and enable it for the school. */
export function useCreateSchoolMaterial(): UseMutationResult<
  MaterialDetail,
  Error,
  CreateSchoolMaterial
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSchoolMaterial) =>
      api.post<MaterialDetail>("/v1/school/material", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school", "material"] });
    },
  });
}

/** What the school writes when it changes a resource of its own. */
export type UpdateSchoolMaterial = {
  id: string;
  input: {
    title?: string;
    type?: string;
    area?: string;
    visible_to?: string;
    description?: string | null;
  };
};

/** Change a resource of the school. */
export function useUpdateSchoolMaterial(): UseMutationResult<
  MaterialDetail,
  Error,
  UpdateSchoolMaterial
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => api.patch<MaterialDetail>(`/v1/school/material/${id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school", "material"] });
    },
  });
}

/** Remove a resource of the school. */
export function useDeleteSchoolMaterial(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/v1/school/material/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school", "material"] });
    },
  });
}

/**
 * The content of the file of a resource.
 *
 * The file is served by the API and shown inside the platform: the
 * material is consulted, not downloaded. The blob is fetched with the
 * session cookie, so the browser can show it without a public address.
 */
export async function fetchSchoolMaterialFile(id: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}/v1/school/material/${id}/file`, {
    credentials: "include",
  });
  if (!response.ok) {
    throw new Error("No se pudo cargar el archivo del recurso.");
  }
  return await response.blob();
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
