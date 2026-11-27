-- =========================================================================
-- teacher_assignments and student_enrollments.
-- -------------------------------------------------------------------------
-- teacher_assignments ties a teacher (school_memberships.user_id) to a
-- course_subject. student_enrollments ties a student (school_memberships
-- .user_id) to a course. Both are scoped per school and enforce uniqueness
-- so the same teacher cannot be assigned twice to the same course_subject
-- and the same student cannot enroll twice in the same course.
-- =========================================================================

create type enrollment_status as enum ('active', 'withdrawn', 'completed');

-- ---------------------------------------------------------------------------
-- teacher_assignments
-- ---------------------------------------------------------------------------
create table public.teacher_assignments (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  course_subject_id uuid not null references public.course_subjects(id) on delete cascade,
  teacher_id        uuid not null references auth.users(id) on delete cascade,
  assigned_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint teacher_assignments_course_subject_teacher_uq unique (course_subject_id, teacher_id)
);

create index teacher_assignments_school_id_idx on public.teacher_assignments (school_id);
create index teacher_assignments_teacher_id_idx on public.teacher_assignments (teacher_id);
create index teacher_assignments_course_subject_id_idx on public.teacher_assignments (course_subject_id);

comment on table public.teacher_assignments is
  'A teacher assigned to teach a specific course_subject. The assignment is unique per (course_subject, teacher).';

create trigger teacher_assignments_set_updated_at
  before update on public.teacher_assignments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- student_enrollments
-- ---------------------------------------------------------------------------
create table public.student_enrollments (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  student_id   uuid not null references auth.users(id) on delete cascade,
  status       enrollment_status not null default 'active',
  enrolled_at  timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint student_enrollments_course_student_uq unique (course_id, student_id)
);

create index student_enrollments_school_id_idx on public.student_enrollments (school_id);
create index student_enrollments_course_id_idx on public.student_enrollments (course_id);
create index student_enrollments_student_id_idx on public.student_enrollments (student_id);

comment on table public.student_enrollments is
  'A student enrolled in a course. Unique per (course, student). status tracks whether the student is currently active.';

create trigger student_enrollments_set_updated_at
  before update on public.student_enrollments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.teacher_assignments enable row level security;
alter table public.student_enrollments enable row level security;

-- teacher_assignments
drop policy if exists teacher_assignments_select on public.teacher_assignments;
create policy teacher_assignments_select
  on public.teacher_assignments
  for select
  to authenticated
  using (is_platform_admin() or (select public.is_school_member(school_id)));

drop policy if exists teacher_assignments_admin_write on public.teacher_assignments;
create policy teacher_assignments_admin_write
  on public.teacher_assignments
  for insert
  to authenticated
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists teacher_assignments_admin_update on public.teacher_assignments;
create policy teacher_assignments_admin_update
  on public.teacher_assignments
  for update
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')))
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists teacher_assignments_admin_delete on public.teacher_assignments;
create policy teacher_assignments_admin_delete
  on public.teacher_assignments
  for delete
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

-- student_enrollments
drop policy if exists student_enrollments_select on public.student_enrollments;
create policy student_enrollments_select
  on public.student_enrollments
  for select
  to authenticated
  using (is_platform_admin() or (select public.is_school_member(school_id)));

drop policy if exists student_enrollments_admin_write on public.student_enrollments;
create policy student_enrollments_admin_write
  on public.student_enrollments
  for insert
  to authenticated
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists student_enrollments_admin_update on public.student_enrollments;
create policy student_enrollments_admin_update
  on public.student_enrollments
  for update
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')))
  with check (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));

drop policy if exists student_enrollments_admin_delete on public.student_enrollments;
create policy student_enrollments_admin_delete
  on public.student_enrollments
  for delete
  to authenticated
  using (is_platform_admin() or (select public.has_school_role(school_id, 'school_admin')));
