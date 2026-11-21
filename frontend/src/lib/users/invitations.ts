// =============================================================================
// The invitation hooks.
// -----------------------------------------------------------------------------
// These call the privileged /v1/users/* endpoints. The backend creates
// the user, the profile and the school membership in one go.
//
// The session travels in the httpOnly cookie, so the client does not
// have to attach anything: `credentials: "include"` does it.
// -----------------------------------------------------------------------------

import { useMutation, useQueryClient, type UseMutationResult } from "@tanstack/react-query";

import { queryKeys } from "@/features/academics/hooks";
import { api } from "@/lib/api/client";
import type {
  ActivationLinkResult,
  BulkInviteResponse,
  InviteUserInput,
  InviteUserResult,
  MembershipUpdateResult,
  UpdateMembershipInput,
} from "@/lib/users/types";

export type {
  ActivationLinkResult,
  BulkInviteFailure,
  BulkInviteResponse,
  InviteUserInput,
  InviteUserResult,
  MembershipUpdateResult,
} from "@/lib/users/types";

/** Build the activation link an admin shares with an invited user. */
export function activationLink(token: string): string {
  const origin =
    typeof window !== "undefined" && window.location?.origin ? window.location.origin : "";
  return `${origin}/activar?token=${encodeURIComponent(token)}`;
}

export function useInviteUser(): UseMutationResult<InviteUserResult, Error, InviteUserInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<InviteUserResult>("/v1/users/invitations", input),
    onSuccess: (result) => {
      // Refresh the members table so the new user shows up right away
      // instead of waiting for React Query to refetch on staleness.
      qc.invalidateQueries({ queryKey: queryKeys.members(result.school_id) });
      // The panel of the school reads its own lists: a new teacher has
      // to appear in them at once.
      qc.invalidateQueries({ queryKey: ["school", "teachers"] });
    },
  });
}

export function useBulkInviteUsers(): UseMutationResult<
  BulkInviteResponse,
  Error,
  InviteUserInput[]
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rows) =>
      api.post<BulkInviteResponse>("/v1/users/bulk-upload", { invitations: rows }),
    onSuccess: () => {
      // A bulk upload can touch any member list; invalidate the whole
      // family so every open members view refetches.
      qc.invalidateQueries({ queryKey: ["school_members"] });
      qc.invalidateQueries({ queryKey: ["school", "teachers"] });
      qc.invalidateQueries({ queryKey: ["school", "students"] });
    },
  });
}

/**
 * Activate or deactivate a member (teacher/student) of the school.
 *
 * Deactivating soft-revokes the membership; reactivating restores it.
 * The backend refuses to let an admin deactivate themselves or the
 * last active admin.
 */
export function useUpdateMembership(): UseMutationResult<
  MembershipUpdateResult,
  Error,
  UpdateMembershipInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, revoked }) =>
      api.patch<MembershipUpdateResult>(`/v1/users/memberships/${membershipId}`, { revoked }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: queryKeys.members(result.school_id) });
      qc.invalidateQueries({ queryKey: ["school", "teachers"] });
      qc.invalidateQueries({ queryKey: ["school", "students"] });
    },
  });
}

/**
 * Issue a fresh activation link for a member who has not activated yet.
 *
 * The link is rotated: the one issued before stops working. The admin
 * shares it from the member's "Gestionar" card.
 */
export function useCreateActivationLink(): UseMutationResult<ActivationLinkResult, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (membershipId: string) =>
      api.post<ActivationLinkResult>(`/v1/users/memberships/${membershipId}/activation-link`),
    onSuccess: () => {
      // The member list changes: the account may already be active.
      qc.invalidateQueries({ queryKey: ["school_members"] });
      qc.invalidateQueries({ queryKey: ["school", "teachers"] });
      qc.invalidateQueries({ queryKey: ["school", "students"] });
    },
  });
}

/**
 * Parse a simple CSV (one row per line, comma-separated) into
 * InviteUserInput[]. The first row is treated as the header. Columns
 * accepted (case-insensitive): email, full_name, role. Empty lines
 * and rows without an email are skipped.
 */
export function parseCsvInvitations(csv: string): InviteUserInput[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const colEmail = header.indexOf("email");
  const colName = header.indexOf("full_name");
  const colRole = header.indexOf("role");
  if (colEmail === -1 || colName === -1) return [];
  const out: InviteUserInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const email = cols[colEmail];
    if (!email) continue;
    const full_name = cols[colName] ?? "";
    const role = (cols[colRole] ?? "teacher").toLowerCase();
    const validRoles = new Set(["school_admin", "teacher", "student"]);
    out.push({
      email,
      full_name: full_name || email.split("@")[0]!,
      role: validRoles.has(role) ? (role as InviteUserInput["role"]) : "teacher",
      is_primary: true,
    });
  }
  return out;
}
