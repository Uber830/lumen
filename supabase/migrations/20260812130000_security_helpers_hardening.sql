-- =========================================================================
-- Security hardening for Phase 1 functions.
-- -------------------------------------------------------------------------
-- Addresses two Supabase linter warnings:
--   1. public.set_updated_at() has a mutable search_path.
--   2. is_school_member/has_school_role/is_platform_admin are callable
--      via the PostgREST /rest/v1/rpc/ endpoint by anon and authenticated.
--      The functions return only the caller's own membership/role status
--      and do not leak data, but the safest posture is to revoke EXECUTE
--      from PUBLIC and explicitly grant only to authenticated, so they are
--      only callable as helpers inside RLS policies (not as RPCs).
-- =========================================================================

-- ---------------------------------------------------------------------------
-- set_updated_at: fix search_path.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Helpers: revoke from PUBLIC, then re-grant to authenticated so PostgREST
-- exposes them only to the anon/auth roles that Supabase documents.
-- In practice, the public client only ever invokes these as part of an
-- RLS policy evaluation; the rpc endpoint is not part of the Lumen API.
-- ---------------------------------------------------------------------------
revoke execute on function public.is_school_member(uuid) from public;
grant execute on function public.is_school_member(uuid) to authenticated;

revoke execute on function public.has_school_role(uuid, school_role) from public;
grant execute on function public.has_school_role(uuid, school_role) to authenticated;

revoke execute on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;
