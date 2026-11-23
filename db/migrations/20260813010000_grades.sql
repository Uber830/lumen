-- =========================================================================
-- grades: per-student, per-course_subject, per-academic_period.
-- -------------------------------------------------------------------------
-- One score per (student, course_subject, academic_period). The score is
-- recorded by a teacher (or auto-calculated from evaluations in a
-- future iteration). 0-5 scale (Colombian grading convention).
-- =========================================================================

create table public.grades (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools(id) on delete cascade,
  course_subject_id   uuid not null references public.course_subjects(id) on delete cascade,
  student_id          uuid not null references auth.users(id) on delete cascade,
  academic_period_id  uuid not null references public.academic_periods(id) on delete cascade,
  score               numeric(4, 2) not null check (score >= 0 and score <= 5),
  notes               text,
  recorded_by         uuid references auth.users(id),
  recorded_at         timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint grades_student_subject_period_uq unique
    (student_id, course_subject_id, academic_period_id)
);

create index grades_school_id_idx on public.grades (school_id);
create index grades_course_subject_id_idx on public.grades (course_subject_id);
create index grades_student_id_idx on public.grades (student_id);
create index grades_academic_period_id_idx on public.grades (academic_period_id);

comment on table public.grades is
  'Final grade for a (student, course_subject, period) tuple. Colombian 0-5 scale.';

create trigger grades_set_updated_at
  before update on public.grades
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.grades enable row level security;

drop policy if exists grades_select on public.grades;
create policy grades_select
  on public.grades
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or student_id = (select auth.uid())
  );

drop policy if exists grades_teacher_write on public.grades;
create policy grades_teacher_write
  on public.grades
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists grades_teacher_update on public.grades;
create policy grades_teacher_update
  on public.grades
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or recorded_by = (select auth.uid())
  )
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists grades_teacher_delete on public.grades;
create policy grades_teacher_delete
  on public.grades
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );
