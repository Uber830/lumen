-- =========================================================================
-- The seed data of a development database.
-- -------------------------------------------------------------------------
-- This mirrors the data of the Supabase project, so a local database
-- behaves like the real one: the same schools, the same plans, the same
-- users and memberships.
--
-- The password hashes are NOT copied. The development accounts use a
-- known password ("lumen-dev") so they can be signed in without
-- hunting for credentials. The Argon2id hash below is that password.
--
-- Apply it with `scripts/dev-db.sh up`, or by hand:
--   psql "$DATABASE_URL" -f supabase/seed.sql
-- =========================================================================

-- The Argon2id hash of "lumen-dev".
\set dev_password_hash '$argon2id$v=19$m=65536,t=3,p=4$wtOvcQICBBqWwbf4NyIw5g$CAjBXJJ+6PFlxgNt/MRqGeIScWbtzwmVuOPC5Ant7V4'

-- ---------------------------------------------------------------------------
-- The plan catalog
--
-- The schema migration already seeds it. This only makes sure the
-- prices and the limits are the current ones.
-- ---------------------------------------------------------------------------
insert into public.plans (
  id, code, name, description, price_cents, currency, interval,
  max_students, max_teachers, max_storage_gb, includes_icfes, is_active
) values
  ('5d7cb672-da17-43cb-9065-2ca5a9f3d2dd', 'basico', 'Basico',
   'Para colegios pequenos que empiezan a digitalizarse.',
   49000, 'COP', 'monthly', 200, 15, 10, false, true),
  ('6cc3f56f-2b42-44a3-aedd-b4d1f69193a3', 'estandar', 'Estandar',
   'El plan mas elegido por instituciones en crecimiento.',
   129000, 'COP', 'monthly', 1500, null, 100, true, true),
  ('4b6abe71-8c02-463c-abf7-09b51036d507', 'premium', 'Premium',
   'Para redes educativas con multiples sedes.',
   299000, 'COP', 'monthly', null, null, 1024, true, true)
on conflict (code) do update
  set id = excluded.id,
      name = excluded.name,
      description = excluded.description,
      price_cents = excluded.price_cents,
      currency = excluded.currency,
      interval = excluded.interval,
      max_students = excluded.max_students,
      max_teachers = excluded.max_teachers,
      max_storage_gb = excluded.max_storage_gb,
      includes_icfes = excluded.includes_icfes,
      is_active = excluded.is_active,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- The schools
-- ---------------------------------------------------------------------------
insert into public.schools (id, name, short_code, status, created_at) values
  ('00000000-0000-0000-0000-000000000001', 'Shared ICFES Bank', 'shared-bank',
   'active', '2026-10-20T04:26:28.305905+00:00'),
  ('168aa116-36d1-4524-a6cf-bf130e03138e', 'Colegio San Martin', 'COLEGIO-SAN-MART',
   'trial', '2026-10-20T15:38:52.782089+00:00'),
  ('bd27f21b-72be-4b22-bf32-3da070985cac', 'Colegio San Juan', 'COLEGIO-SAN-JUAN',
   'trial', '2026-10-20T15:50:13.553762+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The users
--
-- The real project has eight accounts that came from Supabase Auth. They
-- keep their bcrypt hashes there, so their passwords still work. Here
-- they all use the known development password.
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at) values
  ('a44bf071-eb84-4908-80ad-f29b2cbed3a6', 'admin@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('fdc8aab8-58b4-4d5d-adef-86a02bd6e446', 'admin1@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('8cfa9f34-3bd0-4d69-9a30-254a277bb907', 'admin2@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('bfc1e842-a6fc-4cb4-a37e-43903457761a', 'admin3@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('300bd3b7-7b8d-437f-bab2-09e92be25559', 'admin4@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('4c900db5-671d-4d8d-ac98-a712cf03dbde', 'admin5@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('8add5b62-71f0-4fd2-853f-f63b334a500d', 'admin6@cms.edu.co',
   :'dev_password_hash', 'Ricardo Lema', true, '2026-10-20T15:38:52.782089+00:00'),
  ('fa624505-d51f-45c4-9abe-8768c9992075', 'uber@edu.com',
   :'dev_password_hash', 'Uber Cardoso', true, '2026-10-20T15:50:13.553762+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The profiles
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, locale) values
  ('a44bf071-eb84-4908-80ad-f29b2cbed3a6', 'Ricardo Lema', 'es-CO'),
  ('fdc8aab8-58b4-4d5d-adef-86a02bd6e446', 'Ricardo Lema', 'es-CO'),
  ('8cfa9f34-3bd0-4d69-9a30-254a277bb907', 'Ricardo Lema', 'es-CO'),
  ('bfc1e842-a6fc-4cb4-a37e-43903457761a', 'Ricardo Lema', 'es-CO'),
  ('300bd3b7-7b8d-437f-bab2-09e92be25559', 'Ricardo Lema', 'es-CO'),
  ('4c900db5-671d-4d8d-ac98-a712cf03dbde', 'Ricardo Lema', 'es-CO'),
  ('8add5b62-71f0-4fd2-853f-f63b334a500d', 'Ricardo Lema', 'es-CO'),
  ('fa624505-d51f-45c4-9abe-8768c9992075', 'Uber Cardoso', 'es-CO')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The memberships
-- ---------------------------------------------------------------------------
insert into public.school_memberships (
  id, school_id, user_id, role, is_primary, joined_at
) values
  ('e2abb3cc-d241-449d-a3fd-b93c4ab8be74',
   '168aa116-36d1-4524-a6cf-bf130e03138e',
   '8add5b62-71f0-4fd2-853f-f63b334a500d',
   'school_admin', true, '2026-10-20T15:38:52.782089+00:00'),
  ('b1163b8d-4be3-4295-a765-935c89abf872',
   'bd27f21b-72be-4b22-bf32-3da070985cac',
   'fa624505-d51f-45c4-9abe-8768c9992075',
   'school_admin', true, '2026-10-20T15:50:13.553762+00:00')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- The academic structure of the shared bank
-- ---------------------------------------------------------------------------
insert into public.courses (id, school_id, name, grade_label, created_at) values
  ('00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000001',
   'Shared Course', 'Demo', '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

insert into public.subjects (id, school_id, name, area, created_at) values
  ('00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000001',
   'Demo Subject', null, '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;

insert into public.course_subjects (
  id, school_id, course_id, subject_id, created_at
) values
  ('00000000-0000-0000-0000-000000000012',
   '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000010',
   '00000000-0000-0000-0000-000000000011',
   '2026-10-20T04:26:28.305905+00:00')
on conflict (id) do nothing;
