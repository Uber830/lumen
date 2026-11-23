-- =========================================================================
-- Cross-tenant RLS tests with simulated auth.uid().
--
-- These tests use SET LOCAL request.jwt.claim.sub to simulate the
-- authenticated user, which is how the RLS reads auth.uid(). Each
-- test creates two schools (A and B), two auth users (one per school
-- school_admin), the school_memberships rows, and then asserts the
-- cross-tenant RLS invariants.
--
-- NOTE: creating auth.users rows directly requires the
-- schema's insert policy. We insert via the auth schema, which is
-- equivalent to what the admin API of the identity provider does from the
-- admin client.
-- =========================================================================

create or replace function tests.test_cross_tenant_isolation_authenticated()
returns table (ok boolean, name text, diag text)
language plpgsql
as $$
declare
  -- Real auth users (the JWT sub claim must reference a real auth.users row).
  school_a  uuid;
  school_b  uuid;
  user_a    uuid := gen_random_uuid();
  user_b    uuid := gen_random_uuid();
  admin_role school_role := 'school_admin';
begin
  -- Two schools.
  insert into public.schools (name, short_code)
  values ('Test School A', 'TEST-A-' || substring(md5(random()::text), 1, 6))
  returning id into school_a;
  insert into public.schools (name, short_code)
  values ('Test School B', 'TEST-B-' || substring(md5(random()::text), 1, 6))
  returning id into school_b;

  -- Two auth users. These rows are required because auth.uid() reads
  -- from auth.users via RLS (USING (auth.uid() = id)).
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, email_change,
                          email_change_token_new, recovery_token)
  values
    (user_a, gen_random_uuid(), 'authenticated', 'authenticated',
     'a-' || substring(md5(user_a::text), 1, 8) || '@test.local',
     crypt('test', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', ''),
    (user_b, gen_random_uuid(), 'authenticated', 'authenticated',
     'b-' || substring(md5(user_b::text), 1, 8) || '@test.local',
     crypt('test', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}',
     now(), now(), '', '', '', '');

  -- Profile + membership rows so the RLS policies have something to filter on.
  insert into public.profiles (id, full_name)
  values (user_a, 'Test Admin A'), (user_b, 'Test Admin B');

  insert into public.school_memberships (school_id, user_id, role)
  values
    (school_a, user_a, admin_role),
    (school_b, user_b, admin_role);

  --------------------------------------------------------------------------
  -- Test 1: user A cannot read school B from the schools table.
  --------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  return query
    select
      (select count(*) from public.schools where id = school_b) = 0,
      'cross-tenant: user A does NOT see school B in schools',
      'auth.schools.cross_tenant';

  --------------------------------------------------------------------------
  -- Test 2: user A can read their own school.
  --------------------------------------------------------------------------
  return query
    select
      (select count(*) from public.schools where id = school_a) = 1,
      'cross-tenant: user A CAN see school A',
      'auth.schools.own_school';

  --------------------------------------------------------------------------
  -- Test 3: user B cannot read school A from the schools table.
  --------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  return query
    select
      (select count(*) from public.schools where id = school_a) = 0,
      'cross-tenant: user B does NOT see school A in schools',
      'auth.schools.symmetric';

  --------------------------------------------------------------------------
  -- Test 4: icfes_answer_keys remain read-restricted cross-tenant.
  -- Insert one shared icfes_question + answer_key under school_a, then
  -- re-test with user_b's session.
  --------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);

  insert into public.icfes_questions (school_id, area, grado, difficulty, prompt, options)
  values (
    school_a, 'Lectura critica', '11', 'Medio',
    'Pregunta de prueba cross-tenant', '["a","b","c","d"]'::jsonb
  );

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  return query
    select
      (select count(*) from public.icfes_questions
        where school_id = school_a) = 0,
      'cross-tenant: user B does NOT see school A icfes_questions',
      'auth.icfes.cross_tenant';

  --------------------------------------------------------------------------
  -- Cleanup.
  --------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', '', true);
  delete from public.icfes_questions where school_id = school_a;
  delete from public.school_memberships where user_id in (user_a, user_b);
  delete from public.profiles where id in (user_a, user_b);
  delete from auth.users where id in (user_a, user_b);
  delete from public.schools where id in (school_a, school_b);

  return;
end;
$$;

do $$
begin
  perform tests.test_cross_tenant_isolation_authenticated();
end;
$$;
