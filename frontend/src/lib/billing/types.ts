// =============================================================================
// Billing domain types: subscriptions and entitlements.
// -----------------------------------------------------------------------------
// The entities the billing hooks read, plus the subscription response
// envelope.
// =============================================================================

export type Subscription = {
  id: string;
  school_id: string;
  plan_id: string;
  status: string;
  interval: string;
  customer_email: string | null;
  wompi_subscription_id: string | null;
  wompi_payment_source_id: string | null;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  raw: unknown;
  created_at: string;
  updated_at: string;
};

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
  subscription: Subscription | null;
  entitlements: Entitlement | null;
};
