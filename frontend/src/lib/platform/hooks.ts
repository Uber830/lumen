// =============================================================================
// The editorial catalog of the platform role: the hooks of the API.
// -----------------------------------------------------------------------------
// Every call goes to `/v1/platform`, which only the platform team can
// use. The listing asks for one page with its filters in the query: the
// browser never downloads the whole catalog to cut it.
//
// The access of a school is saved without a modal and with an immediate
// effect; when the server refuses it, the change is rolled back and the
// reason is shown.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { ApiError, api, apiBaseUrl } from "@/lib/api/client";
import type {
  AuditEntry,
  CatalogOptions,
  CreateMaterialInput,
  MaterialDetail,
  MaterialStatus,
  Page,
  PlatformMetrics,
  SchoolSummary,
  UploadResult,
} from "@/lib/platform/types";

export const platformKeys = {
  metrics: ["platform", "metrics"] as const,
  options: ["platform", "options"] as const,
  catalog: (filters: CatalogFilters) => ["platform", "catalog", filters] as const,
  material: (id: string | null) => ["platform", "material", id ?? "none"] as const,
  schools: (filters: SchoolFilters) => ["platform", "schools", filters] as const,
  audit: (filters: AuditFilters) => ["platform", "audit", filters] as const,
};

export interface CatalogFilters {
  q?: string;
  type?: string;
  status?: string;
  school_id?: string;
  page?: number;
  per_page?: number;
}

export interface SchoolFilters {
  q?: string;
  plan?: string;
  status?: string;
  page?: number;
  per_page?: number;
}

export interface AuditFilters {
  level?: string;
  school_id?: string;
  event_type?: string;
  page?: number;
  per_page?: number;
}

/** The figures of the global panel. */
export function usePlatformMetrics(): UseQueryResult<PlatformMetrics, Error> {
  return useQuery({
    queryKey: platformKeys.metrics,
    queryFn: () => api.get<PlatformMetrics>("/v1/platform/metrics"),
  });
}

/** The closed catalogs: types, areas, grades and plans. */
export function useCatalogOptions(): UseQueryResult<CatalogOptions, Error> {
  return useQuery({
    queryKey: platformKeys.options,
    queryFn: () => api.get<CatalogOptions>("/v1/platform/catalog-options"),
    staleTime: 5 * 60 * 1000,
  });
}

/** The catalog, filtered and paginated. */
export function useCatalog(
  filters: CatalogFilters,
): UseQueryResult<Page<import("@/lib/platform/types").MaterialSummary>, Error> {
  return useQuery({
    queryKey: platformKeys.catalog(filters),
    queryFn: () =>
      api.get<Page<import("@/lib/platform/types").MaterialSummary>>("/v1/platform/catalog", {
        q: filters.q || undefined,
        type: filters.type || undefined,
        status: filters.status || undefined,
        school_id: filters.school_id || undefined,
        page: filters.page ?? 1,
        per_page: filters.per_page ?? 8,
      }),
    placeholderData: (previous) => previous,
  });
}

/** One material with its files, its access and its history. */
export function useMaterial(id: string | null): UseQueryResult<MaterialDetail, Error> {
  return useQuery({
    queryKey: platformKeys.material(id),
    queryFn: () => api.get<MaterialDetail>(`/v1/platform/catalog/${id}`),
    enabled: !!id,
  });
}

/** The schools of the network, with their coverage. */
export function usePlatformSchools(
  filters: SchoolFilters,
): UseQueryResult<Page<SchoolSummary>, Error> {
  return useQuery({
    queryKey: platformKeys.schools(filters),
    queryFn: () =>
      api.get<Page<SchoolSummary>>("/v1/platform/schools", {
        q: filters.q || undefined,
        plan: filters.plan || undefined,
        status: filters.status || undefined,
        page: filters.page ?? 1,
        per_page: filters.per_page ?? 8,
      }),
    placeholderData: (previous) => previous,
  });
}

/** The audit trail. */
export function useAudit(filters: AuditFilters): UseQueryResult<Page<AuditEntry>, Error> {
  return useQuery({
    queryKey: platformKeys.audit(filters),
    queryFn: () =>
      api.get<Page<AuditEntry>>("/v1/platform/audit", {
        level: filters.level || undefined,
        school_id: filters.school_id || undefined,
        event_type: filters.event_type || undefined,
        page: filters.page ?? 1,
        per_page: filters.per_page ?? 8,
      }),
    placeholderData: (previous) => previous,
  });
}

/** Create a material. It is born as a draft. */
export function useCreateMaterial(): UseMutationResult<MaterialDetail, Error, CreateMaterialInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<MaterialDetail>("/v1/platform/catalog", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });
}

/** Edit the metadata. The state and the access have their own calls. */
export function useUpdateMaterial(): UseMutationResult<
  MaterialDetail,
  Error,
  { id: string; input: Partial<CreateMaterialInput> }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => api.patch<MaterialDetail>(`/v1/platform/catalog/${id}`, input),
    onSuccess: (material) => {
      qc.setQueryData(platformKeys.material(material.id), material);
      qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });
}

/** Move a material to another state. */
export function useChangeMaterialStatus(): UseMutationResult<
  MaterialDetail,
  Error,
  { id: string; status: MaterialStatus }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) =>
      api.post<MaterialDetail>(`/v1/platform/catalog/${id}/status`, { status }),
    onSuccess: (material) => {
      qc.setQueryData(platformKeys.material(material.id), material);
      qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });
}

/**
 * Replace the schools that can see a material.
 *
 * The server answers 409 when a published material loses a school and
 * the change was not confirmed: the caller asks the user and sends the
 * same request with `confirm: true`.
 */
export function useSetMaterialSchools(): UseMutationResult<
  MaterialDetail,
  ApiError,
  { id: string; school_ids: string[]; confirm?: boolean }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, school_ids, confirm }) =>
      api.put<MaterialDetail>(`/v1/platform/catalog/${id}/schools`, {
        school_ids,
        confirm: confirm ?? false,
      }),
    onSuccess: (material) => {
      qc.setQueryData(platformKeys.material(material.id), material);
      qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });
}

/** Delete a material. Only a draft can be deleted. */
export function useDeleteMaterial(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/platform/catalog/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform"] });
    },
  });
}

/**
 * Upload a file of the catalog.
 *
 * The file travels as multipart: the API checks the format and the
 * size, computes the digest and answers whether the file is already in
 * the catalog.
 */
export function useUploadFile(): UseMutationResult<UploadResult, Error, File> {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`${apiBaseUrl}/v1/platform/uploads`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        let detail = `No se pudo subir el archivo (${response.status}).`;
        try {
          const body = (await response.json()) as { detail?: string };
          if (body.detail) detail = body.detail;
        } catch {
          // The body was not JSON: the message above is all we have.
        }
        throw new Error(detail);
      }
      return (await response.json()) as UploadResult;
    },
  });
}

/** Remove a file that was uploaded and is not part of a material yet. */
export function useDeleteUpload(): UseMutationResult<void, Error, string> {
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/platform/uploads/${id}`),
  });
}

export type { MaterialSummary } from "@/lib/platform/types";
