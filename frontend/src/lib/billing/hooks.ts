// =============================================================================
// The billing hooks: the entitlement of the school.
// -----------------------------------------------------------------------------
// The entitlement says what the school has enabled (the ICFES, for
// now). The API owns it; the browser only reads it.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { Entitlement, SubscriptionResponse } from "@/lib/billing/types";

export type { Entitlement };

export const queryKeys = {
  entitlement: (schoolId: string) => ["entitlement", schoolId] as const,
};

export function useEntitlement(schoolId: string | null): UseQueryResult<Entitlement | null, Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.entitlement(schoolId) : ["entitlement", "none"],
    enabled: !!schoolId,
    queryFn: async () => {
      const response = await api.get<SubscriptionResponse>("/v1/subscriptions");
      return response.entitlements;
    },
  });
}
