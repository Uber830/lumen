// =============================================================================
// The student's ICFES attempts.
// -----------------------------------------------------------------------------
// A simulation is a set of questions published by the school. The
// student starts an attempt, answers the questions and finalizes it.
//
// The answer keys stay in the backend: the attempt is scored there,
// when it is finalized. The browser never sees which option is right,
// so it cannot be manipulated.
// =============================================================================

import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { IcfesAttemptScore, IcfesAttemptStart, IcfesSimulation } from "@/lib/api/types";

export const icfesKeys = {
  simulations: (schoolId: string) => ["icfes_simulations", "student", schoolId] as const,
};

/**
 * The simulations the student may take.
 *
 * The API already scopes the list to the caller's school; a draft
 * simulation is filtered out here because it is not published yet.
 */
export function useIcfesSimulations(
  schoolId: string | null,
): UseQueryResult<IcfesSimulation[], Error> {
  return useQuery({
    queryKey: schoolId ? icfesKeys.simulations(schoolId) : ["icfes_simulations", "student", "none"],
    enabled: !!schoolId,
    queryFn: async () => {
      const rows = await api.get<IcfesSimulation[]>("/v1/icfes/simulations");
      return rows.filter((row) => row.is_published);
    },
  });
}

/**
 * Start an attempt at a simulation.
 *
 * The response carries the attempt id and the questions, without the
 * answer keys.
 */
export function useStartIcfesAttempt(): UseMutationResult<IcfesAttemptStart, Error, string> {
  return useMutation({
    mutationFn: (simulationId: string) =>
      api.post<IcfesAttemptStart>(`/v1/icfes/simulations/${simulationId}/attempts`),
  });
}

/** The answer of one question: the index of the chosen option. */
export type IcfesAnswerInput = {
  question_id: string;
  chosen_index: number | null;
};

/** Submit the answers of an attempt and receive the score. */
export function useFinalizeIcfesAttempt(): UseMutationResult<
  IcfesAttemptScore,
  Error,
  { attemptId: string; answers: IcfesAnswerInput[] }
> {
  return useMutation({
    mutationFn: ({ attemptId, answers }) =>
      api.post<IcfesAttemptScore>(`/v1/icfes/attempts/${attemptId}/finalize`, { answers }),
  });
}
