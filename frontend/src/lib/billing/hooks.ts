// =============================================================================
// The billing hooks: the subscription, the entitlement and the checkout.
// -----------------------------------------------------------------------------
// These used to read PostgREST and call the `school_has_icfes` RPC.
// They talk to the API now.
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
  Entitlement,
  StartCheckoutInput,
  StartCheckoutResult,
  Subscription,
  SubscriptionResponse,
} from "@/lib/billing/types";

export type { Entitlement, Subscription };

export const queryKeys = {
  subscription: (schoolId: string) => ["subscription", schoolId] as const,
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

export function useSubscription(
  schoolId: string | null,
): UseQueryResult<Subscription | null, Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.subscription(schoolId) : ["subscription", "none"],
    enabled: !!schoolId,
    queryFn: async () => {
      const response = await api.get<SubscriptionResponse>("/v1/subscriptions");
      return response.subscription;
    },
  });
}

export function useStartCheckout(
  schoolId: string,
): UseMutationResult<StartCheckoutResult, Error, StartCheckoutInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ plan_id }) =>
      api.post<StartCheckoutResult>("/v1/subscriptions/checkout", { plan_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.subscription(schoolId) });
      qc.invalidateQueries({ queryKey: queryKeys.entitlement(schoolId) });
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
