// =============================================================================
// Users domain types: invitations and membership management.
// -----------------------------------------------------------------------------
// Inputs and results for the privileged /v1/users/* endpoints: inviting
// users (single and bulk) and activating/deactivating memberships.
// =============================================================================

export type InviteUserInput = {
  email: string;
  full_name: string;
  role: "school_admin" | "teacher" | "student";
  school_id?: string;
  is_primary?: boolean;
};

export type InviteUserResult = {
  user_id: string;
  email: string;
  role: string;
  school_id: string;
  membership_id: string;
  // One-time token the invited user redeems at /activar to set their
  // first password. Returned to the admin to share, since there is no
  // email provider yet. Null when the user already had a password.
  activation_token: string | null;
};

export type BulkInviteFailure = {
  index: string;
  email: string | null;
  error: string;
};

export type BulkInviteResponse = {
  created: InviteUserResult[];
  failures: BulkInviteFailure[];
};

export type MembershipUpdateResult = {
  membership_id: string;
  school_id: string;
  user_id: string;
  role: string;
  revoked: boolean;
};

export type UpdateMembershipInput = {
  membershipId: string;
  revoked: boolean;
};

/** A fresh activation link for a member whose account is still pending. */
export type ActivationLinkResult = {
  membership_id: string;
  user_id: string;
  email: string;
  activation_token: string;
  expires_at: string;
};
