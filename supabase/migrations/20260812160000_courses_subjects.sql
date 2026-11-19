-- =========================================================================
-- Courses, subjects and the course_subjects join.
-- -------------------------------------------------------------------------
-- A Course is a grade-level group (e.g. "10mo A"). A Subject is a teaching
-- area (e.g. "Matematicas"). course_subjects links the two and is the
-- unit that a teacher gets assigned to and a student enrolls against.
-- =========================================================================

create table public.courses (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  grade_label text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint courses_school_name_uq unique (school_id, name)
);

create index courses_school_id_idx on public.courses (school_id);

comment on table public.courses is
  'Grade-level group (e.g. "10mo A"). Every school decides its own naming convention.';

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute function public.set_updated_at();

create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  name        text not null,
  area        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint subjects_school_name_uq unique (school_id, name)
);

create index subjects_school_id_idx on public.subjects (school_id);

comment on table public.subjects is
  'Subject area (e.g. "Matematicas"). One subject can be taught in many courses.';

create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

create table public.course_subjects (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  course_id   uuid not null references public.courses(id) on delete cascade,
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint course_subjects_course_subject_uq unique (course_id, subject_id)
);

create index course_subjects_school_id_idx on public.course_subjects (school_id);
create index course_subjects_course_id_idx on public.course_subjects (course_id);
create index course_subjects_subject_id_idx on public.course_subjects (subject_id);

comment on table public.course_subjects is
  'A subject offered in a specific course. The unit assigned to teachers and enrolled by students.';

create trigger course_subjects_set_updated_at
  before update on public.course_subjects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.courses enable row level security;
alter table public.subjects enable row level security;
alter table public.course_subjects enable row level security;

-- courses
drop policy if exists courses_select on public.courses;
create policy courses_select
  on public.courses
  for select
  to authenticated
  using (is_platform_admin() or (select public.is_school_member(school_id)));

drop policy if exists courses_admin_write on public.courses;
create policy courses_admin_write
  on public.courses
  for insert
  to authenticated
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists courses_admin_update on public.courses;
create policy courses_admin_update
  on public.courses
  for update
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')))
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists courses_admin_delete on public.courses;
create policy courses_admin_delete
  on public.courses
  for delete
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

-- subjects
drop policy if exists subjects_select on public.subjects;
create policy subjects_select
  on public.subjects
  for select
  to authenticated
  using (is_platform_admin() or (select public.is_school_member(school_id)));

drop policy if exists subjects_admin_write on public.subjects;
create policy subjects_admin_write
  on public.subjects
  for insert
  to authenticated
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists subjects_admin_update on public.subjects;
create policy subjects_admin_update
  on public.subjects
  for update
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')))
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists subjects_admin_delete on public.subjects;
create policy subjects_admin_delete
  on public.subjects
  for delete
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

-- course_subjects
drop policy if exists course_subjects_select on public.course_subjects;
create policy course_subjects_select
  on public.course_subjects
  for select
  to authenticated
  using (is_platform_admin() or (select public.is_school_member(school_id)));

drop policy if exists course_subjects_admin_write on public.course_subjects;
create policy course_subjects_admin_write
  on public.course_subjects
  for insert
  to authenticated
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists course_subjects_admin_update on public.course_subjects;
create policy course_subjects_admin_update
  on public.course_subjects
  for update
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')))
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists course_subjects_admin_delete on public.course_subjects;
create policy course_subjects_admin_delete
  on public.course_subjects
  for delete
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));
