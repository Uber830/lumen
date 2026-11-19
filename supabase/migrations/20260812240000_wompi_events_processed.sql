-- =========================================================================
-- wompi_events_processed: idempotency ledger for the Wompi webhook.
-- -------------------------------------------------------------------------
-- Wompi may retry the same event delivery. The webhook handler inserts a
-- row keyed by event_id; ON CONFLICT DO NOTHING means the second
-- delivery is short-circuited and the existing payload is left intact.
-- =========================================================================

create table public.wompi_events_processed (
  event_id      text primary key,
  event_type    text not null,
  payload       jsonb not null,
  processed_at  timestamptz not null default now()
);

comment on table public.wompi_events_processed is
  'Idempotency ledger for Wompi webhook events. The event_id column is the Wompi event identifier; ON CONFLICT DO NOTHING skips duplicates.';

create index wompi_events_processed_event_type_idx
  on public.wompi_events_processed (event_type);
create index wompi_events_processed_processed_at_idx
  on public.wompi_events_processed (processed_at desc);

-- RLS: only the backend (service role) writes. No policies -> no anon
-- or authenticated role can read or write. Block the table off for
-- direct client access.
alter table public.wompi_events_processed enable row level security;

-- No policies -> only the backend's service role can interact with
-- the table. This makes the idempotency ledger inaccessible from the
-- browser even through PostgREST.

-- ---------------------------------------------------------------------------
-- Helper: returns the active entitlements for a school. The frontend
-- ICFES guard and the entitlement-aware UI call this via PostgREST
-- (which respects RLS). The backend can also call it via the service
-- role for privileged flows.
-- ---------------------------------------------------------------------------
create or replace function public.school_has_icfes(school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select e.includes_icfes
     from public.entitlements e
     where e.school_id = $1
       and e.status in ('active', 'trial')),
    false
  );
$$;

comment on function public.school_has_icfes(uuid) is
  'True if the school has an active or trial subscription that includes ICFES. Used by the RLS policies on ICFES resources and by the ICFES guard.';

revoke execute on function public.school_has_icfes(uuid) from public;
grant execute on function public.school_has_icfes(uuid) to authenticated;
