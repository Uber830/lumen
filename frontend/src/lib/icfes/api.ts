// =============================================================================
// The ICFES client.
// -----------------------------------------------------------------------------
// The attempt lifecycle talks to the API: start an attempt, submit the
// answers, and read the aggregates.
//
// The access token lives in an httpOnly cookie, so the browser sends
// it automatically; the client only has to include the credentials.
//
// The question bank and the simulations are read through the API too.
// The answer keys never reach the browser: the scoring happens on the
// server.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type {
  FinalizeIcfesAttemptInput,
  FinalizeResponse,
  IcfesComparison,
  IcfesSimulation,
  StartAttemptResponse,
  StartIcfesAttemptInput,
} from "@/lib/icfes/types";

export type {
  FinalizeAnswer,
  FinalizeResponse,
  IcfesComparison,
  IcfesQuestionForStudent,
  IcfesSimulation,
  StartAttemptResponse,
} from "@/lib/icfes/types";

export const queryKeys = {
  simulationsByCourseSubject: (courseSubjectId: string) =>
    ["icfes_simulations", "by_course_subject", courseSubjectId] as const,
  attempt: (attemptId: string) => ["icfes_attempt", attemptId] as const,
};

// ---------------------------------------------------------------------------
// Start an attempt
// ---------------------------------------------------------------------------

export function useStartIcfesAttempt(): UseMutationResult<
  StartAttemptResponse,
  Error,
  StartIcfesAttemptInput
> {
  return useMutation({
    mutationFn: ({ simulationId }) =>
      api.post<StartAttemptResponse>(`/v1/icfes/simulations/${simulationId}/attempts`),
  });
}

// ---------------------------------------------------------------------------
// Finalize an attempt
// ---------------------------------------------------------------------------

export function useFinalizeIcfesAttempt(): UseMutationResult<
  FinalizeResponse,
  Error,
  FinalizeIcfesAttemptInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, answers }) =>
      api.post<FinalizeResponse>(`/v1/icfes/attempts/${attemptId}/finalize`, { answers }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.attempt(data.attempt_id) });
    },
  });
}

// ---------------------------------------------------------------------------
// The aggregates, for the teacher view
// ---------------------------------------------------------------------------

export function useIcfesComparisons(
  simulationId?: string,
): UseQueryResult<IcfesComparison[], Error> {
  return useQuery({
    queryKey: ["icfes_comparisons", simulationId ?? "all"],
    queryFn: async () => {
      const response = await api.get<{ comparisons: IcfesComparison[] }>(
        "/v1/icfes/comparisons",
        simulationId ? { simulation_id: simulationId } : undefined,
      );
      return response.comparisons;
    },
  });
}
