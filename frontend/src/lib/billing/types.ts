// =============================================================================
// Billing domain types: the plan of a school and what it enables.
// -----------------------------------------------------------------------------
// The app does not sell anything: the platform team sets the plan when
// the school is registered. These types are what the hooks read.
// =============================================================================

export type Entitlement = {
  school_id: string;
  plan_code: string;
  plan_name: string;
  max_students: number | null;
  max_teachers: number | null;
  max_storage_gb: number | null;
  includes_icfes: boolean;
  subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  updated_at: string;
};

/** The envelope the /v1/subscriptions endpoint returns. */
export type SubscriptionResponse = {
  subscription: Record<string, unknown> | null;
  entitlements: Entitlement | null;
};
