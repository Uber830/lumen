-- =========================================================================
-- Row Level Security policies for the initial tenant schema.
-- -------------------------------------------------------------------------
-- ENABLE RLS on every table and bind policies to the authenticated role.
-- The anon role gets no rows: there is no public read path on the
-- Lumen schema (the landing page is rendered from the application
-- layer, not from anonymous reads).
-- =========================================================================

-- ---------------------------------------------------------------------------
-- public.schools
-- ---------------------------------------------------------------------------
alter table public.schools enable row level security;

drop policy if exists schools_select_member_or_admin on public.schools;
create policy schools_select_member_or_admin
  on public.schools
  for select
  to authenticated
  using (
    is_platform_admin() or (select public.is_school_member(id))
  );

drop policy if exists schools_insert_platform_admin on public.schools;
create policy schools_insert_platform_admin
  on public.schools
  for insert
  to authenticated
  with check (is_platform_admin());

drop policy if exists schools_update_admin on public.schools;
create policy schools_update_admin
  on public.schools
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(id, 'school_admin'))
  )
  with check (
    is_platform_admin()
    or (select public.has_school_role(id, 'school_admin'))
  );

drop policy if exists schools_delete_platform_admin on public.schools;
create policy schools_delete_platform_admin
  on public.schools
  for delete
  to authenticated
  using (is_platform_admin());

-- ---------------------------------------------------------------------------
-- public.profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_self_or_admin on public.profiles;
create policy profiles_select_self_or_admin
  on public.profiles
  for select
  to authenticated
  using (
    is_platform_admin() or (select auth.uid()) = id
  );

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
  on public.profiles
  for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (
    is_platform_admin() or (select auth.uid()) = id
  )
  with check (
    is_platform_admin() or (select auth.uid()) = id
  );

drop policy if exists profiles_delete_platform_admin on public.profiles;
create policy profiles_delete_platform_admin
  on public.profiles
  for delete
  to authenticated
  using (is_platform_admin());

-- ---------------------------------------------------------------------------
-- public.platform_roles
-- ---------------------------------------------------------------------------
alter table public.platform_roles enable row level security;

drop policy if exists platform_roles_select_self_or_admin on public.platform_roles;
create policy platform_roles_select_self_or_admin
  on public.platform_roles
  for select
  to authenticated
  using (
    is_platform_admin() or (select auth.uid()) = user_id
  );

drop policy if exists platform_roles_admin_write on public.platform_roles;
create policy platform_roles_admin_write
  on public.platform_roles
  for insert
  to authenticated
  with check (is_platform_admin());

drop policy if exists platform_roles_admin_update on public.platform_roles;
create policy platform_roles_admin_update
  on public.platform_roles
  for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

drop policy if exists platform_roles_admin_delete on public.platform_roles;
create policy platform_roles_admin_delete
  on public.platform_roles
  for delete
  to authenticated
  using (is_platform_admin());

-- ---------------------------------------------------------------------------
-- public.school_memberships
-- ---------------------------------------------------------------------------
alter table public.school_memberships enable row level security;

drop policy if exists school_memberships_select_self_or_platform_admin on public.school_memberships;
create policy school_memberships_select_self_or_platform_admin
  on public.school_memberships
  for select
  to authenticated
  using (
    is_platform_admin() or (select auth.uid()) = user_id
  );

drop policy if exists school_memberships_admin_insert on public.school_memberships;
create policy school_memberships_admin_insert
  on public.school_memberships
  for insert
  to authenticated
  with check (is_platform_admin());

drop policy if exists school_memberships_admin_update on public.school_memberships;
create policy school_memberships_admin_update
  on public.school_memberships
  for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

drop policy if exists school_memberships_admin_delete on public.school_memberships;
create policy school_memberships_admin_delete
  on public.school_memberships
  for delete
  to authenticated
  using (is_platform_admin());

-- ---------------------------------------------------------------------------
-- public.plans
-- ---------------------------------------------------------------------------
alter table public.plans enable row level security;

drop policy if exists plans_select_authenticated on public.plans;
create policy plans_select_authenticated
  on public.plans
  for select
  to authenticated
  using (is_active or is_platform_admin());

drop policy if exists plans_admin_write on public.plans;
create policy plans_admin_write
  on public.plans
  for insert
  to authenticated
  with check (is_platform_admin());

drop policy if exists plans_admin_update on public.plans;
create policy plans_admin_update
  on public.plans
  for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());

drop policy if exists plans_admin_delete on public.plans;
create policy plans_admin_delete
  on public.plans
  for delete
  to authenticated
  using (is_platform_admin());
