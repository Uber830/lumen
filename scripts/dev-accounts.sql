-- =========================================================================
-- The demo accounts of the development database.
-- -------------------------------------------------------------------------
-- One account of each role, so the whole cycle of the application can be
-- walked without registering anything:
--
--   super@lumen.co            the platform team: the catalog, the schools
--                              and the support desk.
--   ana.restrepo@sagcor.edu.co the administrator of the demo school: the
--                              courses, the people, the assignments and the
--                              periods.
--   docente01@sagcor.edu.co   a teacher of the demo school: the subjects,
--                              the grades and the ICFES bank.
--   estudiante001@sagcor.edu.co a student of the demo school: the classes,
--                              the materials, the tasks and the grades.
--
-- All of them use the password `lumen-dev`.
--
-- The script only guarantees that these accounts are usable: it resets
-- the password, and it makes sure the role and the membership are there.
-- It does not create the school, its courses or its content: that is the
-- work of the seeds (`backend/seeds/20261119120000_school_demo_seed.sql`).
--
-- It is idempotent: it can be applied again as many times as needed.
--
-- Rollback:
--   delete from public.school_memberships where user_id in (...);
--   delete from public.platform_roles where user_id = ...;
--   delete from public.users where email in (...);
-- =========================================================================

\set ON_ERROR_STOP on

-- The hash of `lumen-dev`, the same one the seeds use. It is the argon2
-- hash of that password: the accounts are for the local development only.
\set demo_password_hash '$argon2id$v=19$m=65536,t=3,p=4$wtOvcQICBBqWwbf4NyIw5g$CAjBXJJ+6PFlxgNt/MRqGeIScWbtzwmVuOPC5Ant7V4'


-- ---------------------------------------------------------------------------
-- The school of the demo
--
-- The school comes from the seeds. Without it there is nothing to walk:
-- the script says so instead of failing in the middle.
-- ---------------------------------------------------------------------------
do $$
declare
  school_id_ uuid;
begin
  select id into school_id_ from public.schools where short_code = 'SAGCOR';

  if school_id_ is null then
    raise exception
      'El colegio de la demo no existe. Aplica primero las semillas: ./scripts/dev-db.sh up';
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- The platform team
-- ---------------------------------------------------------------------------
update public.users
set password_hash = :'demo_password_hash'
where email = 'super@lumen.co';

insert into public.platform_roles (user_id, role, granted_at)
select id, 'platform_admin', now()
from public.users
where email = 'super@lumen.co'
on conflict (user_id) do nothing;


-- ---------------------------------------------------------------------------
-- The demo school: its administrator, a teacher and a student
-- ---------------------------------------------------------------------------
update public.users
set password_hash = :'demo_password_hash'
where email in (
  'ana.restrepo@sagcor.edu.co',
  'docente01@sagcor.edu.co',
  'estudiante001@sagcor.edu.co'
);

insert into public.school_memberships (
  id, school_id, user_id, role, admin_role, is_primary, joined_at
)
select
  gen_random_uuid(),
  s.id,
  u.id,
  m.role::public.school_role,
  m.admin_role::public.school_admin_role,
  m.is_primary,
  now()
from public.schools s
join (values
  ('ana.restrepo@sagcor.edu.co', 'school_admin', 'principal', true),
  ('docente01@sagcor.edu.co', 'teacher', null, false),
  ('estudiante001@sagcor.edu.co', 'student', null, false)
) as m(email, role, admin_role, is_primary) on true
join public.users u on u.email = m.email
where s.short_code = 'SAGCOR'
on conflict (school_id, user_id, role) do nothing;


-- ---------------------------------------------------------------------------
-- The profile of the administrator
--
-- The panel shows the name of the person, and it reads it from the
-- profile. Without it the account enters with an empty name.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, given_name, family_name, created_at)
select u.id, u.full_name, 'Ana', 'Restrepo', now()
from public.users u
where u.email = 'ana.restrepo@sagcor.edu.co'
on conflict (id) do update set full_name = excluded.full_name;
