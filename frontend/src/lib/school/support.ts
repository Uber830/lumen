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

import { api } from "@/lib/api/client";

/** One message of the thread of a case. */
export type SupportMessage = {
  id: string;
  author_id: string | null;
  /** colegio or plataforma. */
  author_role: string;
  author_name: string;
  body: string;
  created_at: string;
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

export const supportKeys = {
  cases: () => ["school", "support", "cases"] as const,
  case: (caseId: string) => ["school", "support", "cases", caseId] as const,
};

/**
 * The requests of the school to the support team.
 *
 * The query can be switched off for the roles that do not have the
 * channel: the rail only counts the open cases of the administrator.
 */
export function useSchoolSupportCases(enabled = true): UseQueryResult<SupportCaseSummary[], Error> {
  return useQuery({
    queryKey: supportKeys.cases(),
    enabled,
    queryFn: () => api.get<SupportCaseSummary[]>("/v1/school/support/cases"),
  });
}

/** How many cases of the school are still open. */
export function openCaseCount(cases: SupportCaseSummary[] | undefined): number {
  return (cases ?? []).filter((item) => item.status !== "resuelto").length;
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
  { title: string; category: string; body: string }
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
  { caseId: string; body: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ caseId, body }) =>
      api.post<SupportCase>(`/v1/school/support/cases/${caseId}/messages`, { body }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: supportKeys.cases() });
      qc.setQueryData(supportKeys.case(updated.id), updated);
    },
  });
}
