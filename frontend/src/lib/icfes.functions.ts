import { createServerFn } from "@tanstack/react-start";

import { getCurrentSession } from "@/lib/auth/functions";
import { readAccessToken } from "@/lib/auth/cookies.server";
import { apiAs } from "@/lib/api/client";

/**
 * ICFES access check.
 *
 * Reads the entitlements row for the caller's school and says whether
 * ICFES is currently enabled. The entitlements table is the single
 * source of truth.
 */
export const getIcfesAccess = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getCurrentSession();
  if (!session) {
    return { allowed: false };
  }

  const token = readAccessToken();
  if (!token) {
    return { allowed: false };
  }

  const response = await apiAs.get<{
    subscription: unknown;
    entitlements: {
      plan_code: string;
      plan_name: string;
      status: string;
      includes_icfes: boolean;
    } | null;
  }>("/v1/subscriptions", token);

  const entitlement = response.entitlements;
  const allowed = Boolean(
    entitlement &&
    entitlement.includes_icfes &&
    (entitlement.status === "active" || entitlement.status === "trial"),
  );

  return { allowed };
});
