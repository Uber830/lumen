// =============================================================================
// The channel with the support team.
// -----------------------------------------------------------------------------
// The school opens a request and the platform team answers it in the same
// thread. The school can add information, but it never resolves a case:
// there is no button for that in this panel.
//
// Every query is filtered by the school of the session. The client never
// sends the school id.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api, apiBaseUrl } from "@/lib/api/client";
import { useEvent } from "@/lib/events/event-stream";

/** One message of the thread of a case. */
export type SupportMessage = {
  id: string;
  author_id: string | null;
  /** colegio or plataforma. */
  author_role: string;
  author_name: string;
  body: string;
  /** The files the author attached to the message. */
  attachment_ids: string[];
  created_at: string;
};

/** A file uploaded to attach to a request. */
export type SupportAttachment = {
  /** The path of the file in the store: it is what the thread keeps. */
  id: string;
  name: string;
  size: number;
  url: string;
};

/** One request of the school, as it appears in the list. */
export type SupportCaseSummary = {
  id: string;
  code: string;
  title: string;
  category: string;
  channel: string;
  level: string;
  /** abierto, en_espera or resuelto. */
  status: string;
  opened_at: string;
  opened_by: string | null;
  opened_by_name: string;
  /** How many messages the thread has. */
  messages: number;
};

/** One request of the school, with its thread. */
export type SupportCase = Omit<SupportCaseSummary, "messages"> & {
  resolved_at: string | null;
  messages: SupportMessage[];
};

/** The categories a school can pick when it opens a request. */
export const SUPPORT_CATEGORIES = [
  { id: "problema_tecnico", label: "Problema técnico" },
  { id: "solicitud_material", label: "Solicitud de material" },
  { id: "duda_acceso", label: "Duda de acceso" },
  { id: "otro", label: "Otro" },
] as const;

/** A page of the requests of the school. */
export type SupportCasePage = {
  items: SupportCaseSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
};

/** The filters of the list of requests. */
export type SupportCaseFilters = {
  page?: number;
  per_page?: number;
  /** The text to look for: the title or the code of the request. */
  q?: string;
};

export const supportKeys = {
  cases: (filters: SupportCaseFilters = {}) => ["school", "support", "cases", filters] as const,
  case: (caseId: string) => ["school", "support", "case", caseId] as const,
  openCount: ["school", "support", "open-count"] as const,
};

/**
 * The requests of the school to the support team.
 *
 * The query can be switched off for the roles that do not have the
 * channel: the rail only counts the open cases of the administrator.
 */
export function useSchoolSupportCases(
  filters: SupportCaseFilters = {},
  enabled = true,
): UseQueryResult<SupportCasePage, Error> {
  const qc = useQueryClient();

  // The bell says that there is something new in the thread: the list
  // is asked again, so the answer of the platform shows up without a
  // reload.
  useEvent("notification", () => {
    qc.invalidateQueries({ queryKey: ["school", "support"] });
  });

  return useQuery({
    queryKey: supportKeys.cases(filters),
    enabled,
    queryFn: () =>
      api.get<SupportCasePage>("/v1/school/support/cases", {
        page: filters.page ?? 1,
        per_page: filters.per_page ?? 10,
        ...(filters.q ? { q: filters.q } : {}),
      }),
  });
}

/**
 * How many requests of the school are still open.
 *
 * The number is its own call: the list is cut in pages and the badge
 * counts every case of the school, not only the ones of the first page.
 */
export function useOpenSupportCaseCount(enabled = true): UseQueryResult<number, Error> {
  return useQuery({
    queryKey: supportKeys.openCount,
    enabled,
    queryFn: async () => {
      const body = await api.get<{ count: number }>("/v1/school/support/open-count");
      return body.count;
    },
  });
}

/** One request of the school, with its thread. */
export function useSchoolSupportCase(caseId: string | null): UseQueryResult<SupportCase, Error> {
  return useQuery({
    queryKey: supportKeys.case(caseId ?? "none"),
    enabled: Boolean(caseId),
    queryFn: () => api.get<SupportCase>(`/v1/school/support/cases/${caseId}`),
  });
}

/** Open a request to the support team. */
export function useOpenSupportCase(): UseMutationResult<
  SupportCase,
  Error,
  { title: string; category: string; body: string; attachment_ids?: string[] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => api.post<SupportCase>("/v1/school/support/cases", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: supportKeys.cases() });
    },
  });
}

/** Add information to the thread of a request. */
export function useAddSupportMessage(): UseMutationResult<
  SupportCase,
  Error,
  { caseId: string; body: string; attachment_ids?: string[] }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, body, attachment_ids }) =>
      api.post<SupportCase>(`/v1/school/support/cases/${caseId}/messages`, {
        body,
        attachment_ids,
      }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: supportKeys.cases() });
      qc.setQueryData(supportKeys.case(updated.id), updated);
    },
  });
}

/**
 * Upload a file to attach to a request.
 *
 * The file goes to the store of the school and the path it gets back is
 * what the thread keeps: the message points at the file.
 */
export function useUploadSupportAttachment(): UseMutationResult<SupportAttachment, Error, File> {
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      const response = await fetch(`${apiBaseUrl}/v1/school/support/attachments`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!response.ok) {
        let detail = `No se pudo adjuntar el archivo (${response.status}).`;
        try {
          const body = await response.json();
          detail = body?.detail ?? detail;
        } catch {
          // The answer was not JSON: the message above is enough.
        }
        throw new Error(detail);
      }
      return (await response.json()) as SupportAttachment;
    },
  });
}
