-- =========================================================================
-- Helper: returns the active entitlements for a school.
-- -------------------------------------------------------------------------
-- The frontend ICFES guard and the entitlement-aware UI call this via
-- PostgREST (which respects RLS). The backend can also call it via the
-- service role for privileged flows.
--
-- It used to be declared at the end of the payment migration,
-- which no longer exists; the RLS policies of the ICFES resources need
-- it, so it lives here now, before them.
-- =========================================================================
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
