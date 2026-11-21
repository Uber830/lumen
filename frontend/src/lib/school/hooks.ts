// =============================================================================
// The school profile hook: read the school's branding.
// -----------------------------------------------------------------------------
// Backs the app-shell brand: the rail shows the name and the shield of
// the school. The school is always the caller's own (the backend
// resolves it from the session); the id is only used as a React Query
// cache key.
//
// The identity is written through `/v1/school/settings`, which owns the
// validation of the colour and the shield (see `lib/school/identity`).
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { School } from "@/lib/school/types";

export type { School };

export const schoolKeys = {
  me: (schoolId: string | null) => ["school", schoolId ?? "none"] as const,
};

/** The caller's school, including its branding. */
export function useSchool(schoolId: string | null): UseQueryResult<School, Error> {
  return useQuery({
    queryKey: schoolKeys.me(schoolId),
    enabled: !!schoolId,
    queryFn: () => api.get<School>("/v1/schools/me"),
  });
}
