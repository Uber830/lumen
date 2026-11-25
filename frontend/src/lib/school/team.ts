// =============================================================================
// The team of administrators of the school.
// -----------------------------------------------------------------------------
// Two ranks, and the difference has to be visible in the interface: the
// principal runs the school, the secundario helps. The frontend does not
// decide what a rank may do: the API returns the permissions of the
// caller and of each member of the team.
//
// The school has a single principal: the rank is handed over from one
// person to another, so the API refuses to create a second one and to
// demote or remove the last one.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** One thing the rank of an administrator may do. */
export type AdminPermission = {
  permission: string;
  label: string;
};

/** One administrator of the school. */
export type SchoolAdmin = {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  joined_at: string;
  /** principal or secundario. */
  admin_role: "principal" | "secundario";
  /** activo or inactivo. */
  status: "activo" | "inactivo";
  account_activated: boolean;
  /** What this rank may do, spelled out. */
  permissions: AdminPermission[];
};

/** The answer of an invitation. */
export type AdminInvitation = {
  user_id: string;
  email: string;
  membership_id: string;
  admin_role: string;
  activation_token: string | null;
};

export const teamKeys = {
  admins: () => ["school", "admins"] as const,
};

/** The team of administrators of the school. */
export function useSchoolAdmins(): UseQueryResult<SchoolAdmin[], Error> {
  return useQuery({
    queryKey: teamKeys.admins(),
    queryFn: () => api.get<SchoolAdmin[]>("/v1/school/admins"),
  });
}

/** Invite an administrator to the team. Only the principal can. */
export function useInviteAdmin(): UseMutationResult<
  AdminInvitation,
  Error,
  { email: string; full_name: string; admin_role: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<AdminInvitation>("/v1/school/admins/invite", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.admins() });
    },
  });
}

/** Change the rank of an administrator. */
export function useUpdateAdminRank(): UseMutationResult<
  SchoolAdmin,
  Error,
  { membership_id: string; admin_role: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membership_id, admin_role }) =>
      api.patch<SchoolAdmin>(`/v1/school/admins/${membership_id}`, { admin_role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.admins() });
    },
  });
}

/**
 * Hand the principal rank over to another administrator.
 *
 * The school has a single principal: the rank moves from one person
 * to another, and the one who gives it away stays in the team.
 */
export function useTransferPrincipal(): UseMutationResult<
  SchoolAdmin,
  Error,
  { membership_id: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membership_id }) =>
      api.post<SchoolAdmin>(`/v1/school/admins/${membership_id}/transfer`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.admins() });
    },
  });
}

/** Remove an administrator from the team. */
export function useRemoveAdmin(): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (membershipId) => api.delete<void>(`/v1/school/admins/${membershipId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamKeys.admins() });
    },
  });
}
