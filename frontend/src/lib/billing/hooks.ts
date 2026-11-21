// =============================================================================
// The billing hooks: the subscription, the entitlement and the checkout.
// -----------------------------------------------------------------------------
// These used to read PostgREST and call the `school_has_icfes` RPC.
// They talk to the API now.
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

/**
 * Whether the school has the ICFES entitlement.
 *
 * The entitlement row carries the flag, so there is no separate call:
 * the entitlement query already answers it.
 */
export function useSchoolHasIcves(schoolId: string | null): UseQueryResult<boolean, Error> {
  return useQuery({
    queryKey: schoolId ? ["school_has_icfes", schoolId] : ["school_has_icfes", "none"],
    enabled: !!schoolId,
    queryFn: async () => {
      const response = await api.get<SubscriptionResponse>("/v1/subscriptions");
      const entitlement = response.entitlements;
      return Boolean(
        entitlement &&
        entitlement.includes_icfes &&
        (entitlement.status === "active" || entitlement.status === "trial"),
      );
    },
  });
}
