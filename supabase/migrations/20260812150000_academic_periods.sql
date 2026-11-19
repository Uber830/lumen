-- =========================================================================
-- Academic periods (e.g. "1er Trimestre 2026").
-- -------------------------------------------------------------------------
-- Every academic row in Lumen must reference an academic_periods.id so
-- calificaciones, evaluaciones and grading reports can be scoped by period.
-- =========================================================================

create type academic_period_modality as enum ('bimestre', 'trimestre', 'semestre', 'anual');

create table public.academic_periods (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  modality    academic_period_modality not null,
  start_date  date not null,
  end_date    date not null,
  is_current  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint academic_periods_school_name_uq unique (school_id, name),
  constraint academic_periods_dates_ck check (end_date >= start_date)
);

create index academic_periods_school_id_idx on public.academic_periods (school_id);

comment on table public.academic_periods is
  'Períodos académicos definidos por el colegio. Exactly one row per school may have is_current=true; a partial unique index enforces that.';

create unique index academic_periods_one_current_per_school_idx
  on public.academic_periods (school_id)
  where is_current;

create trigger academic_periods_set_updated_at
  before update on public.academic_periods
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.academic_periods enable row level security;

drop policy if exists academic_periods_select on public.academic_periods;
create policy academic_periods_select
  on public.academic_periods
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_school_member(school_id))
  );

drop policy if exists academic_periods_admin_write on public.academic_periods;
create policy academic_periods_admin_write
  on public.academic_periods
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );

drop policy if exists academic_periods_admin_update on public.academic_periods;
create policy academic_periods_admin_update
  on public.academic_periods
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  )
  with check (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );

drop policy if exists academic_periods_admin_delete on public.academic_periods;
create policy academic_periods_admin_delete
  on public.academic_periods
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );
