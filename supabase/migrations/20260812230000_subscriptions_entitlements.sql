-- =========================================================================
-- subscriptions and entitlements.
-- -------------------------------------------------------------------------
-- A subscription binds a school to a plan over a period. The entitlements
-- table is a denormalized cache of the active subscription's plan limits
-- so that RLS policies and the ICFES guard can read them cheaply.
-- =========================================================================

create type subscription_status as enum (
  'pending',
  'active',
  'past_due',
  'cancelled',
  'expired',
  'trial'
);

create type billing_interval as enum ('monthly', 'quarterly', 'annual');

create table public.subscriptions (
  id                       uuid primary key default gen_random_uuid(),
  school_id                uuid not null references public.schools(id) on delete cascade,
  plan_id                  uuid not null references public.plans(id) on delete restrict,
  status                   subscription_status not null default 'pending',
  interval                 billing_interval not null,
  customer_email           text,
  wompi_subscription_id    text,
  wompi_payment_source_id  text,
  started_at               timestamptz,
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancelled_at             timestamptz,
  raw                      jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  constraint subscriptions_school_uq unique (school_id)
);

create index subscriptions_status_idx on public.subscriptions (status);
create index subscriptions_plan_id_idx on public.subscriptions (plan_id);
create index subscriptions_wompi_subscription_id_idx
  on public.subscriptions (wompi_subscription_id)
  where wompi_subscription_id is not null;

comment on table public.subscriptions is
  'One subscription per school. Upserted by the Wompi webhook when the school subscribes or changes plan.';

create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- Only one active subscription per school at a time. A unique
-- partial index keeps history rows but forbids a second 'active' row.
create unique index subscriptions_one_active_per_school_idx
  on public.subscriptions (school_id)
  where status = 'active';

-- ---------------------------------------------------------------------------
-- entitlements: cached plan limits for the school's active subscription.
-- ---------------------------------------------------------------------------
create table public.entitlements (
  school_id        uuid primary key references public.schools(id) on delete cascade,
  plan_code        text not null,
  plan_name        text not null,
  max_students     integer,
  max_teachers     integer,
  max_storage_gb   integer,
  includes_icfes   boolean not null default false,
  -- Subscription identity for traceability / debugging.
  subscription_id  uuid references public.subscriptions(id) on delete set null,
  -- status mirrors the active subscription status so RLS / the ICFES
  -- guard can reason about it without joining plans / subscriptions.
  status           subscription_status not null,
  current_period_end timestamptz,
  updated_at       timestamptz not null default now()
);

comment on table public.entitlements is
  'Cached entitlement snapshot for the school. One row per school, rewritten by the Wompi webhook when the subscription state changes.';

create trigger entitlements_set_updated_at
  before update on public.entitlements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;

-- subscriptions
drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select
  on public.subscriptions
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_school_member(school_id))
  );

drop policy if exists subscriptions_service_write on public.subscriptions;
create policy subscriptions_service_write
  on public.subscriptions
  for insert
  to authenticated
  with check (is_platform_admin());

drop policy if exists subscriptions_service_update on public.subscriptions;
create policy subscriptions_service_update
  on public.subscriptions
  for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

drop policy if exists subscriptions_service_delete on public.subscriptions;
create policy subscriptions_service_delete
  on public.subscriptions
  for delete
  to authenticated
  using (is_platform_admin());

-- entitlements
drop policy if exists entitlements_select on public.entitlements;
create policy entitlements_select
  on public.entitlements
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_school_member(school_id))
  );

drop policy if exists entitlements_service_write on public.entitlements;
create policy entitlements_service_write
  on public.entitlements
  for insert
  to authenticated
  with check (is_platform_admin());

drop policy if exists entitlements_service_update on public.entitlements;
create policy entitlements_service_update
  on public.entitlements
  for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

drop policy if exists entitlements_service_delete on public.entitlements;
create policy entitlements_service_delete
  on public.entitlements
  for delete
  to authenticated
  using (is_platform_admin());
