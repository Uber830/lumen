// =============================================================================
// The plan catalog.
// -----------------------------------------------------------------------------
// The catalog is public: the landing page shows it before anyone
// signs in, so this endpoint needs no session.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { Plan } from "@/lib/billing/types";

export type { Plan };

export function usePlans(): UseQueryResult<Plan[], Error> {
  return useQuery({
    queryKey: ["plans", "all"],
    queryFn: () => api.get<Plan[]>("/v1/plans"),
  });
}

/**
 * The plans, with the number of schools on each.
 *
 * The count is platform-wide information, so it is only for the
 * platform admin. The API does not expose it yet; the hook returns the
 * plans without the counts.
 */
export function usePlansWithCounts(): UseQueryResult<
  Array<Plan & { schools_count: number }>,
  Error
> {
  return useQuery({
    queryKey: ["plans", "with_counts"],
    queryFn: async () => {
      const plans = await api.get<Plan[]>("/v1/plans");
      return plans.map((plan) => ({ ...plan, schools_count: 0 }));
    },
  });
}
