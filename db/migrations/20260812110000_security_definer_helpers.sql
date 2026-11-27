-- =========================================================================
-- SECURITY DEFINER helpers used by RLS policies in subsequent migrations.
-- -------------------------------------------------------------------------
-- These helpers are intentionally non-invoker (the function owner runs the
-- query) so they can read their own tables without being subject to RLS.
-- They use a fixed search_path to avoid search-path attacks.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- is_school_member: does the current authenticated user have an active
-- membership in the given school?
-- ---------------------------------------------------------------------------
create or replace function public.is_school_member(school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships m
    where m.school_id = $1
      and m.user_id = (select auth.uid())
      and m.revoked_at is null
  );
$$;

comment on function public.is_school_member(uuid) is
  'True if the current authenticated user has an active membership in the given school. Used by RLS policies.';

-- ---------------------------------------------------------------------------
-- has_school_role: does the current user have the given role in the school?
-- ---------------------------------------------------------------------------
create or replace function public.has_school_role(school_id uuid, role school_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships m
    where m.school_id = $1
      and m.user_id = (select auth.uid())
      and m.role = $2
      and m.revoked_at is null
  );
$$;

comment on function public.has_school_role(uuid, school_role) is
  'True if the current authenticated user has the given role in the given school. Used by RLS policies.';

-- ---------------------------------------------------------------------------
-- is_platform_admin: does the current user have a global platform_admin role?
-- ---------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_roles
    where user_id = (select auth.uid())
      and role = 'platform_admin'
  );
$$;

comment on function public.is_platform_admin() is
  'True if the current authenticated user has platform_admin in public.platform_roles. Used by RLS policies.';

-- ---------------------------------------------------------------------------
-- Grants: all three helpers are callable from the authenticated role.
-- ---------------------------------------------------------------------------
grant execute on function public.is_school_member(uuid) to authenticated;
grant execute on function public.has_school_role(uuid, school_role) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
