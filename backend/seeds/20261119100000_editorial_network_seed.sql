-- =========================================================================
-- The seed of the network for the platform role.
-- -------------------------------------------------------------------------
-- DEMONSTRATION DATA. It fills the panel of the platform team with a
-- network to look at from the first boot:
--
--   24 schools              the institutions, with their plan.
--   a community             one administrator, two teachers and two
--                            students per school, so that the panel has
--                            real figures to show.
--
-- It is idempotent: it can be applied again without duplicating
-- anything.
--
-- The schools carry the code "DEMO01"..."DEMO24" so that it is obvious
-- which rows belong to this demonstration set.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- The platform team that loads the catalog
--
-- The account is the one of the main seed. It is created here too, so
-- that this seed can be applied on its own.
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at)
values (
  '00000000-0000-0000-0000-000000000101', 'super@lumen.co', '', 'Super Lumen', true,
  '2026-10-20T04:26:28.305905+00:00'
)
on conflict (email) do nothing;

insert into public.platform_roles (user_id, role, granted_at)
values (
  '00000000-0000-0000-0000-000000000101', 'platform_admin',
  '2026-10-20T04:26:28.305905+00:00'
)
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- The schools of the network
-- ---------------------------------------------------------------------------
insert into public.schools (id, name, short_code, status, display_name, created_at) values
  ('d0000001-0000-4000-8000-000000000001', 'Sagrado Corazón', 'DEMO01', 'active', 'Sagrado Corazón', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000002', 'Los Alpes', 'DEMO02', 'active', 'Los Alpes', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000003', 'Santa María', 'DEMO03', 'active', 'Santa María', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000004', 'El Roble', 'DEMO04', 'active', 'El Roble', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000005', 'La Primavera', 'DEMO05', 'trial', 'La Primavera', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000006', 'San Rafael', 'DEMO06', 'active', 'San Rafael', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000007', 'Montessori Belmont', 'DEMO07', 'active', 'Montessori Belmont', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000008', 'Nueva Granada', 'DEMO08', 'active', 'Nueva Granada', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000009', 'Los Nogales', 'DEMO09', 'trial', 'Los Nogales', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000010', 'El Carmen', 'DEMO10', 'active', 'El Carmen', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000011', 'Santa Catalina', 'DEMO11', 'active', 'Santa Catalina', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000012', 'San Juan de Dios', 'DEMO12', 'active', 'San Juan de Dios', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000013', 'Los Arrayanes', 'DEMO13', 'trial', 'Los Arrayanes', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000014', 'La Mersé', 'DEMO14', 'active', 'La Mersé', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000015', 'San Vicente', 'DEMO15', 'active', 'San Vicente', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000016', 'El Guadual', 'DEMO16', 'active', 'El Guadual', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000017', 'Colegio Mayor', 'DEMO17', 'active', 'Colegio Mayor', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000018', 'La Amiga', 'DEMO18', 'trial', 'La Amiga', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000019', 'Monte Carlo', 'DEMO19', 'active', 'Monte Carlo', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000020', 'San Lucas', 'DEMO20', 'active', 'San Lucas', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000021', 'La Salle', 'DEMO21', 'active', 'La Salle', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000022', 'San Ignacio', 'DEMO22', 'trial', 'San Ignacio', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000023', 'Los Pinos', 'DEMO23', 'active', 'Los Pinos', '2026-10-01T08:00:00+00:00'),
  ('d0000001-0000-4000-8000-000000000024', 'Santa Bárbara', 'DEMO24', 'active', 'Santa Bárbara', '2026-10-01T08:00:00+00:00')
on conflict (short_code) do update
  set name = excluded.name,
      display_name = excluded.display_name,
      status = excluded.status;

-- ---------------------------------------------------------------------------
-- The plan of each school
--
-- The entitlements cache is what the panel reads to show the plan of a
-- school.
-- ---------------------------------------------------------------------------
insert into public.entitlements (
  school_id, plan_code, plan_name, max_students, max_teachers,
  max_storage_gb, includes_icfes, status, updated_at
)
select
  s.id,
  p.code,
  p.name,
  p.max_students,
  p.max_teachers,
  p.max_storage_gb,
  p.includes_icfes,
  'active',
  now()
from public.schools s
join (
  values
    ('DEMO01', 'estandar'), ('DEMO02', 'premium'), ('DEMO03', 'basico'),
    ('DEMO04', 'estandar'), ('DEMO05', 'basico'), ('DEMO06', 'estandar'),
    ('DEMO07', 'premium'), ('DEMO08', 'estandar'), ('DEMO09', 'basico'),
    ('DEMO10', 'estandar'), ('DEMO11', 'basico'), ('DEMO12', 'estandar'),
    ('DEMO13', 'basico'), ('DEMO14', 'premium'), ('DEMO15', 'estandar'),
    ('DEMO16', 'basico'), ('DEMO17', 'premium'), ('DEMO18', 'basico'),
    ('DEMO19', 'estandar'), ('DEMO20', 'basico'), ('DEMO21', 'premium'),
    ('DEMO22', 'basico'), ('DEMO23', 'estandar'), ('DEMO24', 'basico')
  ) as d(short_code, plan_code) on d.short_code = s.short_code
join public.plans p on p.code = d.plan_code
on conflict (school_id) do update
  set plan_code = excluded.plan_code,
      plan_name = excluded.plan_name,
      max_students = excluded.max_students,
      max_teachers = excluded.max_teachers,
      max_storage_gb = excluded.max_storage_gb,
      includes_icfes = excluded.includes_icfes,
      status = excluded.status,
      updated_at = now();

-- ---------------------------------------------------------------------------
-- The community of the demonstration
--
-- One administrator, two teachers and two students per school, so that
-- the panel has real figures to show. The accounts have no password:
-- they are demonstration rows, not people who sign in.
-- ---------------------------------------------------------------------------
insert into public.users (id, email, password_hash, full_name, email_verified, created_at)
select
  ('a0000001-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
  'admin' || lpad(s.n::text, 2, '0') || '@demo.local',
  '',
  'Administrador ' || lpad(s.n::text, 2, '0'),
  true,
  '2026-10-01T08:00:00+00:00'
from (values (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12),
             (13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23), (24)
      ) as s(n)
on conflict (email) do nothing;

insert into public.users (id, email, password_hash, full_name, email_verified, created_at)
select
  ('b0000001-0000-4000-8000-' || lpad((s.n * 2 - 1)::text, 12, '0'))::uuid,
  'docente' || lpad((s.n * 2 - 1)::text, 2, '0') || '@demo.local',
  '',
  'Docente ' || lpad((s.n * 2 - 1)::text, 2, '0'),
  true,
  '2026-10-01T08:00:00+00:00'
from (values (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12),
             (13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23), (24)
      ) as s(n)
on conflict (email) do nothing;

insert into public.users (id, email, password_hash, full_name, email_verified, created_at)
select
  ('c0000001-0000-4000-8000-' || lpad((s.n * 2)::text, 12, '0'))::uuid,
  'estudiante' || lpad((s.n * 2)::text, 2, '0') || '@demo.local',
  '',
  'Estudiante ' || lpad((s.n * 2)::text, 2, '0'),
  true,
  '2026-10-01T08:00:00+00:00'
from (values (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12),
             (13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23), (24)
      ) as s(n)
on conflict (email) do nothing;

insert into public.profiles (id, full_name, locale)
select id, full_name, 'es-CO' from public.users where email like '%@demo.local'
on conflict (id) do nothing;

insert into public.school_memberships (
  id, school_id, user_id, role, is_primary, joined_at
)
select
  ('e0000001-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
  sc.id,
  ('a0000001-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
  'school_admin',
  true,
  '2026-10-01T08:00:00+00:00'
from (values (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12),
             (13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23), (24)
      ) as s(n)
join public.schools sc on sc.short_code = 'DEMO' || lpad(s.n::text, 2, '0')
on conflict (school_id, user_id, role) do nothing;

insert into public.school_memberships (
  id, school_id, user_id, role, is_primary, joined_at
)
select
  ('e1000001-0000-4000-8000-' || lpad((s.n * 2 - 1)::text, 12, '0'))::uuid,
  sc.id,
  ('b0000001-0000-4000-8000-' || lpad((s.n * 2 - 1)::text, 12, '0'))::uuid,
  'teacher',
  true,
  '2026-10-01T08:00:00+00:00'
from (values (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12),
             (13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23), (24)
      ) as s(n)
join public.schools sc on sc.short_code = 'DEMO' || lpad(s.n::text, 2, '0')
on conflict (school_id, user_id, role) do nothing;

insert into public.school_memberships (
  id, school_id, user_id, role, is_primary, joined_at
)
select
  ('e2000001-0000-4000-8000-' || lpad((s.n * 2)::text, 12, '0'))::uuid,
  sc.id,
  ('c0000001-0000-4000-8000-' || lpad((s.n * 2)::text, 12, '0'))::uuid,
  'student',
  true,
  '2026-10-01T08:00:00+00:00'
from (values (1), (2), (3), (4), (5), (6), (7), (8), (9), (10), (11), (12),
             (13), (14), (15), (16), (17), (18), (19), (20), (21), (22), (23), (24)
      ) as s(n)
join public.schools sc on sc.short_code = 'DEMO' || lpad(s.n::text, 2, '0')
on conflict (school_id, user_id, role) do nothing;
