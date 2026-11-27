-- =========================================================================
-- Cross-tenant RLS isolation tests (Phase 6, Fase 7 of the plan).
--
-- This migration installs the pgTAP extension and adds a suite of
-- assertions that prove the helper RLS predicates actually keep
-- school A from leaking into school B.
--
-- The tests rely on the standard simulation pattern of the database:
--   SET LOCAL request.jwt.claim.sub = '<user-uuid>';
-- which the host applies through its connection proxy. Inside the
-- same transaction we can then run RLS-bound queries and check the
-- result with `SELECT is(empty, format(...))`.
--
-- Run via:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/sql-tests/cross_tenant.sql
-- (the tests are not part of the continuous integration).
-- =========================================================================

create extension if not exists pgtap with schema extensions;

create or replace function tests.test_cross_tenant_isolation()
returns table (ok boolean, name text, diag text)
language plpgsql
as $$
declare
  -- Test fixtures: two schools and one user per school.
  school_a uuid;
  school_b uuid;
  user_a   uuid := gen_random_uuid();
  user_b   uuid := gen_random_uuid();
  class_id uuid;
begin
  --------------------------------------------------------------------------
  -- Set up two schools.
  --------------------------------------------------------------------------
  insert into public.schools (name, short_code)
  values ('Test School A', 'TEST-A-' || substring(md5(random()::text), 1, 6))
  returning id into school_a;

  insert into public.schools (name, short_code)
  values ('Test School B', 'TEST-B-' || substring(md5(random()::text), 1, 6))
  returning id into school_b;

  insert into public.profiles (id, full_name)
  values (user_a, 'Test Admin A'), (user_b, 'Test Admin B');

  insert into public.school_memberships (school_id, user_id, role)
  values
    (school_a, user_a, 'school_admin'),
    (school_b, user_b, 'school_admin');

  --------------------------------------------------------------------------
  -- Test 1: user A cannot read school B's row in schools.
  --------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  return query
    select
      (select count(*) from public.schools where id = school_b) = 0,
      'cross-tenant: user A must NOT see school B',
      'cross-tenant.schools.count';

  --------------------------------------------------------------------------
  -- Test 2: user A can read their own school.
  --------------------------------------------------------------------------
  return query
    select
      (select count(*) from public.schools where id = school_a) = 1,
      'cross-tenant: user A CAN see their own school',
      'cross-tenant.schools.own';

  --------------------------------------------------------------------------
  -- Test 3: icfes_questions are not visible cross-tenant.
  --------------------------------------------------------------------------
  insert into public.course_subjects (school_id, course_id, subject_id)
  values (school_a, gen_random_uuid(), gen_random_uuid())
  returning id into class_id;

  insert into public.icfes_questions (school_id, area, grado, difficulty, prompt, options)
  values (
    school_a, 'Lectura critica', '11', 'Medio',
    'Pregunta de prueba', '["a","b","c","d"]'::jsonb
  );

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  return query
    select
      (select count(*) from public.icfes_questions where school_id = school_a) = 0,
      'cross-tenant: user B must NOT see school A questions',
      'cross-tenant.icfes_questions';

  --------------------------------------------------------------------------
  -- Test 4: school_has_icfes() is false without entitlements.
  --------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  return query
    select
      (select public.school_has_icfes(school_a)) = false,
      'entitlement: school_has_icfes() is false without row',
      'entitlement.empty';

  insert into public.entitlements (
    school_id, plan_code, plan_name, status, includes_icfes
  )
  values (school_a, 'estandar', 'Estandar', 'active', true);

  return query
    select
      (select public.school_has_icfes(school_a)) = true,
      'entitlement: school_has_icfes() is true with active row',
      'entitlement.active';

  --------------------------------------------------------------------------
  -- Cleanup.
  --------------------------------------------------------------------------
  delete from public.entitlements where school_id = school_a;
  delete from public.icfes_questions where school_id = school_a;
  delete from public.course_subjects where school_id = school_a;
  delete from public.school_memberships where user_id in (user_a, user_b);
  delete from public.profiles where id in (user_a, user_b);
  delete from public.schools where id in (school_a, school_b);

  return;
end;
$$;

create or replace function tests.test_icfes_entitlement_active_and_trial()
returns void
language plpgsql
as $$
declare
  s uuid := gen_random_uuid();
begin
  insert into public.schools (name, short_code)
  values ('School Active Trial', 'AT-' || substring(md5(random()::text), 1, 6))
  returning id into s;

  -- active => true
  insert into public.entitlements (school_id, plan_code, plan_name, status, includes_icfes)
  values (s, 'p', 'P', 'active', true);
  return next ok(public.school_has_icfes(s), 'active => has ICFES');

  -- trial => true
  update public.entitlements set status = 'trial' where school_id = s;
  return next ok(public.school_has_icfes(s), 'trial => has ICFES');

  -- cancelled => false
  update public.entitlements set status = 'cancelled' where school_id = s;
  return next not_ok(public.school_has_icfes(s), 'cancelled => NO ICFES');

  -- expired => false
  update public.entitlements set status = 'expired' where school_id = s;
  return next not_ok(public.school_has_icfes(s), 'expired => NO ICFES');

  -- past_due => false (no grace window yet)
  update public.entitlements set status = 'past_due' where school_id = s;
  return next not_ok(public.school_has_icfes(s), 'past_due => NO ICFES');

  delete from public.entitlements where school_id = s;
  delete from public.schools where id = s;
end;
$$;

-- Run the suites in a single transaction so the test outputs roll up.
do $$
begin
  perform tests.test_cross_tenant_isolation();
  perform tests.test_icfes_entitlement_active_and_trial();
end;
$$;
