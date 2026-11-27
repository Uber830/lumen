-- =========================================================================
-- bootstrap_school: SECURITY DEFINER RPC for the initial school signup.
-- -------------------------------------------------------------------------
-- A new user that just signed up cannot insert
-- a row into public.schools (the RLS policy requires is_platform_admin).
-- This RPC runs with the function owner's privileges (postgres), validates
-- the inputs, creates the school, the admin membership, the trial
-- subscription and the entitlements cache, and returns the new ids.
--
-- Idempotent: if the calling user already has a primary school_membership,
-- the function returns that school and does not create a duplicate. The
-- caller should treat "already bootstrapped" as a success.
-- =========================================================================

create or replace function public.bootstrap_school(
  p_school_name  text,
  p_short_code   text,
  p_plan_code    text,
  p_trial_days   integer default 30
)
returns table (
  school_id        uuid,
  membership_id    uuid,
  subscription_id  uuid,
  entitlement_id   uuid,
  already_existed  boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller           uuid := (select auth.uid());
  v_plan_id          uuid;
  v_plan_name        text;
  v_plan_max_students integer;
  v_plan_max_teachers integer;
  v_plan_max_storage integer;
  v_plan_includes_icfes boolean;
  v_existing_school  uuid;
  v_school_id        uuid;
  v_membership_id    uuid;
  v_subscription_id  uuid;
  v_entitlement_id   uuid;
  v_period_start     timestamptz := now();
  v_period_end       timestamptz := now() + make_interval(days => p_trial_days);
  v_already          boolean := false;
begin
  if v_caller is null then
    raise exception 'bootstrap_school requires an authenticated caller'
      using errcode = '42501';
  end if;

  -- Validate inputs.
  if p_school_name is null or length(trim(p_school_name)) = 0 then
    raise exception 'school_name is required' using errcode = '22023';
  end if;
  if p_short_code is null or length(trim(p_short_code)) = 0 then
    raise exception 'short_code is required' using errcode = '22023';
  end if;
  if p_plan_code is null or length(trim(p_plan_code)) = 0 then
    raise exception 'plan_code is required' using errcode = '22023';
  end if;
  if p_trial_days is null or p_trial_days < 1 or p_trial_days > 365 then
    raise exception 'trial_days must be between 1 and 365' using errcode = '22023';
  end if;

  -- Idempotency: if the caller already has a primary membership, return
  -- the existing school without creating anything new.
  select m.school_id
    into v_existing_school
    from public.school_memberships m
   where m.user_id = v_caller
     and m.is_primary
     and m.revoked_at is null
   limit 1;

  if v_existing_school is not null then
    v_school_id := v_existing_school;
    v_already   := true;
  else
    -- Resolve the plan. Plan code is unique and stable.
    select p.id, p.name, p.max_students, p.max_teachers,
           p.max_storage_gb, p.includes_icfes
      into v_plan_id, v_plan_name, v_plan_max_students, v_plan_max_teachers,
           v_plan_max_storage, v_plan_includes_icfes
      from public.plans p
     where p.code = p_plan_code
       and p.is_active;

    if v_plan_id is null then
      raise exception 'plan % not found or inactive', p_plan_code
        using errcode = 'P0002';
    end if;

    -- Create the school. short_code is unique; rely on the constraint
    -- to detect duplicates (raises unique_violation 23505).
    insert into public.schools (name, short_code, status)
    values (trim(p_school_name), upper(trim(p_short_code)), 'trial')
    returning id into v_school_id;

    -- The admin membership. is_primary = true so the session picks
    -- this school as primary.
    insert into public.school_memberships (school_id, user_id, role, is_primary)
    values (v_school_id, v_caller, 'school_admin', true)
    returning id into v_membership_id;

    -- Trial subscription: status='trial', interval='monthly' by default
    -- (the platform team rewrites this when the plan of the school changes).
    insert into public.subscriptions (
      school_id, plan_id, status, interval,
      started_at, current_period_start, current_period_end
    )
    values (
      v_school_id, v_plan_id, 'trial', 'monthly',
      v_period_start, v_period_start, v_period_end
    )
    returning id into v_subscription_id;

    -- Entitlements cache. This is the row the ICFES guard and any
    -- RLS policy that asks "does this school have feature X?" reads.
    --
    -- The unqualified `school_id` in the original RETURNING was ambiguous
    -- with subscriptions.school_id, which is in scope after the previous
    -- insert. Aliasing the entitlements insert disambiguates the column
    -- reference and also matches the pattern used everywhere else in the
    -- codebase for multi-table functions.
    insert into public.entitlements as e (
      school_id, plan_code, plan_name,
      max_students, max_teachers, max_storage_gb,
      includes_icfes, subscription_id, status, current_period_end
    )
    values (
      v_school_id, p_plan_code, v_plan_name,
      v_plan_max_students, v_plan_max_teachers, v_plan_max_storage,
      v_plan_includes_icfes, v_subscription_id, 'trial', v_period_end
    )
    returning e.school_id into v_entitlement_id;
  end if;

  return query
  select v_school_id, v_membership_id, v_subscription_id, v_entitlement_id, v_already;
end;
$$;

comment on function public.bootstrap_school(text, text, text, integer) is
  'Phase 1 signup: creates school + admin membership + trial subscription + entitlements '
  'for the calling user. Idempotent: returns the existing school if the caller already '
  'has a primary membership. Runs with the function owner privileges to bypass the '
  'is_platform_admin() check that the schools/subscriptions RLS policies enforce.';

-- Restrict the RPC to authenticated users only.
revoke execute on function public.bootstrap_school(text, text, text, integer) from public;
grant execute on function public.bootstrap_school(text, text, text, integer) to authenticated;
