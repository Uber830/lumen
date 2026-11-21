-- =========================================================================
-- The school administrator's schema.
-- -------------------------------------------------------------------------
-- The admin of a school runs the day to day of the institution: the
-- teachers, the students, the courses, the assignments, the academic
-- periods, the identity of the school and the team of administrators.
--
-- This migration gives that role the data it needs:
--
--   school_admin_role    the two ranks of the school's admin team
--                        (principal and secundario). The rank decides
--                        what the admin may do; the frontend receives
--                        the resulting permission list from the API
--                        and never decides on its own.
--   school_memberships   the invitation trail of the admin team
--                        (who invited whom, and when).
--   school_settings      the preferences of a school, which do not
--                        belong to its identity: notifications and
--                        enrolment.
--   materials            the editorial catalog with the files. The
--   material_schools     platform team uploads the material and
--   material_courses     decides which school sees each piece.
--   academic_periods     the closure of a period and the modality of
--                        the teaching.
--   users.last_login_at  when the account was last used.
--   icfes_simulations    the link to the catalog and the average
--                        score of a simulation.
--
-- The school of the caller is always deduced from the session token;
-- these tables carry `school_id` so that the queries can filter by it.
--
-- Rollback:
--   drop table if exists public.material_courses;
--   drop table if exists public.material_schools;
--   drop table if exists public.materials;
--   drop table if exists public.school_settings;
--   alter table public.icfes_simulations drop column if exists status;
--   alter table public.icfes_simulations drop column if exists average_score;
--   alter table public.icfes_simulations drop column if exists material_id;
--   alter table public.academic_periods drop column if exists delivery_modality;
--   alter table public.academic_periods drop column if exists closed_at;
--   alter table public.users drop column if exists last_login_at;
--   alter table public.school_memberships drop constraint if exists
--     school_memberships_admin_role_ck;
--   drop trigger if exists school_memberships_assign_admin_role
--     on public.school_memberships;
--   drop function if exists public.assign_school_admin_role();
--   alter table public.school_memberships drop column if exists invited_at;
--   alter table public.school_memberships drop column if exists invited_by;
--   alter table public.school_memberships drop column if exists admin_role;
--   drop type if exists public.delivery_modality;
--   drop type if exists public.school_admin_role;
-- =========================================================================

-- ---------------------------------------------------------------------------
-- The two ranks of the school's admin team
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.school_admin_role as enum ('principal', 'secundario');
exception
  when duplicate_object then null;
end $$;

comment on type public.school_admin_role is
  'The rank of a school administrator: principal runs the school, secundario helps.';

-- ---------------------------------------------------------------------------
-- How the teaching is delivered
--
-- The academic period already carries a `modality` column, but it
-- holds the length of the cycle (bimestre, trimestre...). This one
-- holds how the class is given.
-- ---------------------------------------------------------------------------
do $$
begin
  create type public.delivery_modality as enum ('presencial', 'virtual', 'hibrida');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- The rank of the administrators, and who invited them
-- ---------------------------------------------------------------------------
alter table public.school_memberships
  add column if not exists admin_role public.school_admin_role;

alter table public.school_memberships
  add column if not exists invited_by uuid references public.users(id) on delete set null;

alter table public.school_memberships
  add column if not exists invited_at timestamptz;

comment on column public.school_memberships.admin_role is
  'The rank of a school administrator. Null for teachers and students.';
comment on column public.school_memberships.invited_by is
  'The administrator who invited this one. Null for the ones that came with the school.';
comment on column public.school_memberships.invited_at is
  'When the invitation was made.';

-- The administrators that already existed keep their access: the
-- first one of each school, by joining date, becomes the principal and
-- the rest become secundarios. No school is left without a principal.
with ranked as (
  select
    id,
    row_number() over (partition by school_id order by joined_at, id) as position
  from public.school_memberships
  where role = 'school_admin'
)
update public.school_memberships as membership
set admin_role = case
  when ranked.position = 1 then 'principal'::public.school_admin_role
  else 'secundario'::public.school_admin_role
end
from ranked
where membership.id = ranked.id
  and membership.admin_role is null;

-- A membership that does not say which rank it has gets one: the
-- first administrator of a school is its principal, the ones that
-- come later are secundarios. The trigger keeps the rule even when
-- the row is written by something that does not know about it (the
-- inherited seed, a script, a future import).
create or replace function public.assign_school_admin_role()
returns trigger
language plpgsql
as $$
begin
  if new.role = 'school_admin' and new.admin_role is null then
    if exists (
      select 1
      from public.school_memberships as membership
      where membership.school_id = new.school_id
        and membership.role = 'school_admin'
        and membership.admin_role = 'principal'
        and membership.revoked_at is null
    ) then
      new.admin_role := 'secundario';
    else
      new.admin_role := 'principal';
    end if;
  end if;
  return new;
end;
$$;

comment on function public.assign_school_admin_role() is
  'Gives a rank to an administrator that arrives without one.';

drop trigger if exists school_memberships_assign_admin_role on public.school_memberships;
create trigger school_memberships_assign_admin_role
  before insert or update of role, admin_role on public.school_memberships
  for each row execute function public.assign_school_admin_role();

-- A teacher or a student is never an administrator, and an
-- administrator always has a rank. The constraint is only added when it
-- is not there yet: a database where this migration was applied and
-- then stopped halfway does not fail again.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'school_memberships_admin_role_ck'
  ) then
    alter table public.school_memberships
      add constraint school_memberships_admin_role_ck
      check (
        (role = 'school_admin' and admin_role is not null)
        or (role <> 'school_admin' and admin_role is null)
      );
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The closure of an academic period
--
-- `is_current` keeps saying which period is the current one; `closed_at`
-- says when a period was closed, and the modality how the teaching was
-- given.
-- ---------------------------------------------------------------------------
alter table public.academic_periods
  add column if not exists closed_at timestamptz;

alter table public.academic_periods
  add column if not exists delivery_modality public.delivery_modality;

comment on column public.academic_periods.closed_at is
  'When the period was closed. Its material stays in the history of the school.';
comment on column public.academic_periods.delivery_modality is
  'Whether the period was given in person, online or in a mixed way.';

-- ---------------------------------------------------------------------------
-- The last sign-in of an account
-- ---------------------------------------------------------------------------
alter table public.users
  add column if not exists last_login_at timestamptz;

comment on column public.users.last_login_at is
  'When the account was used for the last time.';

-- ---------------------------------------------------------------------------
-- The preferences of a school
--
-- One row per school. The identity of the school lives in `schools`;
-- what the school wants to be told about lives here.
-- ---------------------------------------------------------------------------
create table if not exists public.school_settings (
  school_id                 uuid primary key references public.schools(id) on delete cascade,
  notify_new_material       boolean not null default true,
  notify_period_reminders   boolean not null default true,
  notify_channel            text not null default 'inapp',
  enrollment_open           boolean not null default true,
  enrollment_notes          text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint school_settings_notify_channel_ck
    check (notify_channel in ('email', 'inapp'))
);

comment on table public.school_settings is
  'The preferences of a school: notifications and enrolment. One row per school.';

drop trigger if exists school_settings_set_updated_at on public.school_settings;
create trigger school_settings_set_updated_at
  before update on public.school_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The editorial catalog, with the files
--
-- The platform team uploads the material here and decides which school
-- sees each piece. A school never writes in these tables.
-- ---------------------------------------------------------------------------
create table if not exists public.materials (
  id               uuid primary key default gen_random_uuid(),
  -- The short code shown in the tables: C-1041.
  ref              text not null,
  title            text not null,
  description      text,
  area             text not null,
  kind             text not null,
  storage_path     text,
  file_name        text,
  file_size_bytes  bigint,
  state            text not null default 'borrador',
  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint materials_ref_uq unique (ref),
  constraint materials_kind_ck
    check (kind in ('pdf', 'docx', 'epub', 'mp4', 'zip')),
  constraint materials_state_ck
    check (state in ('borrador', 'en_revision', 'publicado', 'archivado'))
);

comment on table public.materials is
  'The material of the editorial catalog, uploaded by the platform team.';

-- ---------------------------------------------------------------------------
-- The shape of the catalog is decided here
--
-- Another branch of the project (the team of the platform) also declares a
-- table called `materials`, with its own columns: `code`, `type`, `status`
-- and the files in a table of their own. `create table if not exists` does
-- not touch a table that already exists, so when that migration ran first
-- this one would find a catalog it does not understand and the panel of the
-- school would break.
--
-- The decision is that **this shape is the one that stays**: the catalog of
-- the material keeps the file in the piece itself and names its columns
-- `ref`, `kind` and `state`. So this block brings a catalog that arrived in
-- the other shape to this one: the columns are added, the data that the
-- other shape holds is brought over, and the constraints of this shape are
-- put in place. It is idempotent: on a database where this migration ran
-- first, it does nothing.
-- ---------------------------------------------------------------------------
alter table public.materials add column if not exists ref text;
alter table public.materials add column if not exists kind text;
alter table public.materials add column if not exists storage_path text;
alter table public.materials add column if not exists file_name text;
alter table public.materials add column if not exists file_size_bytes bigint;
alter table public.materials add column if not exists state text;

do $$
declare
  tiene_code boolean := false;
  tiene_type boolean := false;
  tiene_status boolean := false;
  tiene_files boolean := false;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'code'
  ) into tiene_code;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'type'
  ) into tiene_type;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'status'
  ) into tiene_status;

  select exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'material_files'
  ) into tiene_files;

  -- The short code: the one of the other shape, or one built from the id.
  if tiene_code then
    update public.materials set ref = code where ref is null;
  end if;
  update public.materials
  set ref = 'C-' || upper(left(replace(id::text, '-', ''), 8))
  where ref is null;

  -- The kind of the file: the type of the other shape, translated.
  if tiene_type then
    update public.materials
    set kind = case type
      when 'Libro' then 'epub'
      when 'Documento' then 'docx'
      when 'Multimedia' then 'mp4'
      else 'pdf'
    end
    where kind is null;
  end if;
  update public.materials set kind = 'pdf' where kind is null;

  -- The state: the status of the other shape, translated.
  if tiene_status then
    update public.materials
    set state = case status
      when 'review' then 'en_revision'
      when 'published' then 'publicado'
      when 'archived' then 'archivado'
      else 'borrador'
    end
    where state is null;
  end if;
  update public.materials set state = 'borrador' where state is null;

  -- The file: the primary one of the other shape, when it had its own table.
  if tiene_files then
    update public.materials m
    set storage_path = f.storage_key,
        file_name = f.file_name,
        file_size_bytes = f.size_bytes
    from public.material_files f
    where f.material_id = m.id
      and (f.is_primary or not exists (
        select 1 from public.material_files other
        where other.material_id = m.id and other.is_primary
      ))
      and m.storage_path is null;
  end if;
end $$;

-- Each value has one name only. The columns of the other shape are
-- dropped once their values are in `ref`, `kind` and `state`: two
-- columns with the same value drift apart the moment one of the two
-- teams writes a new material.
--
-- The team of the platform adapts its queries to these names: `ref` for
-- the code, `kind` for the type of the file and `state` for the state
-- of the piece. The rest of its columns (the grades, the visibility, the
-- order of the landing) stay as they are.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'code'
  ) then
    alter table public.materials drop column code;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'type'
  ) then
    alter table public.materials drop column type;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'status'
  ) then
    alter table public.materials drop column status;
  end if;
end $$;

-- The constraints of this shape, when the table arrived in the other one.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'materials_ref_uq'
  ) then
    alter table public.materials add constraint materials_ref_uq unique (ref);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'materials_kind_ck'
  ) then
    alter table public.materials add constraint materials_kind_ck
      check (kind in ('pdf', 'docx', 'epub', 'mp4', 'zip'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'materials_state_ck'
  ) then
    alter table public.materials add constraint materials_state_ck
      check (state in ('borrador', 'en_revision', 'publicado', 'archivado'));
  end if;
end $$;

alter table public.materials alter column ref set not null;
alter table public.materials alter column kind set not null;
alter table public.materials alter column state set not null;
alter table public.materials alter column state set default 'borrador';

create index if not exists materials_state_idx on public.materials (state);
create index if not exists materials_area_idx on public.materials (area);

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at
  before update on public.materials
  for each row execute function public.set_updated_at();

create table if not exists public.material_schools (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  enabled     boolean not null default true,
  enabled_at  timestamptz not null default now(),
  constraint material_schools_material_school_uq unique (material_id, school_id)
);

-- The access of a school to a material has one shape: a row with its own
-- id, the flag that says whether the access is on, and the moment it was
-- archived for that school. A table that arrived in another shape (with
-- the pair of columns as its key) is brought to this one.
alter table public.material_schools add column if not exists id uuid;
alter table public.material_schools add column if not exists enabled boolean;
alter table public.material_schools add column if not exists archived_at timestamptz;

update public.material_schools set id = gen_random_uuid() where id is null;
update public.material_schools set enabled = true where enabled is null;

alter table public.material_schools alter column id set default gen_random_uuid();
alter table public.material_schools alter column id set not null;
alter table public.material_schools alter column enabled set default true;
alter table public.material_schools alter column enabled set not null;

do $$
begin
  -- The key of the table is its own id, and the pair of columns keeps
  -- saying that a school sees a material only once.
  if exists (
    select 1 from pg_constraint
    where conname = 'material_schools_pkey'
      and pg_get_constraintdef(oid) not like '%(id)%'
  ) then
    alter table public.material_schools drop constraint material_schools_pkey;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'material_schools_pkey'
  ) then
    alter table public.material_schools
      add constraint material_schools_pkey primary key (id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'material_schools_material_school_uq'
  ) then
    alter table public.material_schools
      add constraint material_schools_material_school_uq unique (material_id, school_id);
  end if;
end $$;

comment on table public.material_schools is
  'The schools with access to a material. A school only sees what is enabled for it.';

create index if not exists material_schools_school_idx on public.material_schools (school_id);

create table if not exists public.material_courses (
  id          uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  constraint material_courses_material_course_uq unique (material_id, course_id)
);

comment on table public.material_courses is
  'The courses a material applies to. A material with no course applies to the whole school.';

create index if not exists material_courses_course_idx on public.material_courses (course_id);

-- ---------------------------------------------------------------------------
-- The simulations of the school
--
-- A simulation can come from the editorial catalog, which is what the
-- `material_id` links. The status and the average score are filled in
-- as the simulation is corrected.
-- ---------------------------------------------------------------------------
alter table public.icfes_simulations
  add column if not exists material_id uuid references public.materials(id) on delete set null;

alter table public.icfes_simulations
  add column if not exists average_score numeric(6,2);

alter table public.icfes_simulations
  add column if not exists status text;

comment on column public.icfes_simulations.material_id is
  'The material of the catalog this simulation comes from, when it is enabled for the school.';
comment on column public.icfes_simulations.average_score is
  'The average score of the school. Null until the simulation is corrected.';
comment on column public.icfes_simulations.status is
  'programado, en_correccion or cerrado.';

-- The simulations that were already published are scheduled ones. The
-- unpublished ones keep a null status: the API reports them as not
-- published yet, and nobody loses a row.
update public.icfes_simulations
set status = 'programado'
where status is null
  and is_published;

alter table public.icfes_simulations
  add constraint icfes_simulations_status_ck
  check (status is null or status in ('programado', 'en_correccion', 'cerrado'));

-- ---------------------------------------------------------------------------
-- RLS, with no policies
--
-- The API connects with the owner role, which the policies do not
-- affect. The tables start from a closed door, like the rest of the
-- public schema.
-- ---------------------------------------------------------------------------
alter table public.school_settings enable row level security;
alter table public.materials enable row level security;
alter table public.material_schools enable row level security;
alter table public.material_courses enable row level security;
