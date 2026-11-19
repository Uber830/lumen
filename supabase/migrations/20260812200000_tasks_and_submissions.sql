-- =========================================================================
-- tasks and task_submissions.
-- -------------------------------------------------------------------------
-- tasks are assignments a teacher posts to a course_subject. Each task
-- can have many task_submissions (one per student); the submission
-- carries the text, an optional file path, status, and grade/feedback.
-- =========================================================================

create type task_submission_status as enum ('draft', 'submitted', 'graded', 'returned');

create table public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  course_subject_id  uuid not null references public.course_subjects(id) on delete cascade,
  posted_by          uuid not null references auth.users(id) on delete restrict,
  title              text not null,
  description        text,
  due_at             timestamptz,
  max_score          numeric(5, 2),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint tasks_max_score_check check (max_score is null or max_score >= 0)
);

create index tasks_school_id_idx on public.tasks (school_id);
create index tasks_course_subject_id_idx on public.tasks (course_subject_id);
create index tasks_posted_by_idx on public.tasks (posted_by);

comment on table public.tasks is
  'A teacher-posted assignment for a course_subject. due_at is optional (some tasks have no deadline).';

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

create table public.task_submissions (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  task_id      uuid not null references public.tasks(id) on delete cascade,
  student_id   uuid not null references auth.users(id) on delete cascade,
  body         text,
  file_path    text,
  status       task_submission_status not null default 'draft',
  submitted_at timestamptz,
  grade        numeric(5, 2),
  feedback     text,
  graded_by    uuid references auth.users(id),
  graded_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint task_submissions_task_student_uq unique (task_id, student_id),
  constraint task_submissions_grade_check check (grade is null or grade >= 0),
  constraint task_submissions_consistency_check check (
    (status = 'submitted' and submitted_at is not null) or
    (status in ('draft', 'returned') and submitted_at is null) or
    (status = 'graded' and submitted_at is not null and grade is not null and graded_at is not null)
  )
);

create index task_submissions_school_id_idx on public.task_submissions (school_id);
create index task_submissions_task_id_idx on public.task_submissions (task_id);
create index task_submissions_student_id_idx on public.task_submissions (student_id);

comment on table public.task_submissions is
  'One submission per (task, student). status tracks draft, submitted, graded, or returned (returned means the teacher asked for changes).';

create trigger task_submissions_set_updated_at
  before update on public.task_submissions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;

-- tasks
drop policy if exists tasks_select on public.tasks;
create policy tasks_select
  on public.tasks
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or (select public.is_course_student(school_id, (select course_id from public.course_subjects where id = course_subject_id)))
  );

drop policy if exists tasks_teacher_write on public.tasks;
create policy tasks_teacher_write
  on public.tasks
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists tasks_teacher_update on public.tasks;
create policy tasks_teacher_update
  on public.tasks
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  )
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists tasks_teacher_delete on public.tasks;
create policy tasks_teacher_delete
  on public.tasks
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

-- task_submissions
drop policy if exists task_submissions_select on public.task_submissions;
create policy task_submissions_select
  on public.task_submissions
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(
          school_id,
          (select course_subject_id from public.tasks where id = task_id)
        ))
    or student_id = (select auth.uid())
  );

drop policy if exists task_submissions_student_write on public.task_submissions;
create policy task_submissions_student_write
  on public.task_submissions
  for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.school_id = school_id
    )
  );

drop policy if exists task_submissions_student_update on public.task_submissions;
create policy task_submissions_student_update
  on public.task_submissions
  for update
  to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.is_course_subject_teacher(
          school_id,
          (select course_subject_id from public.tasks where id = task_id)
        ))
  )
  with check (
    student_id = (select auth.uid())
    or (select public.is_course_subject_teacher(
          school_id,
          (select course_subject_id from public.tasks where id = task_id)
        ))
  );

drop policy if exists task_submissions_owner_delete on public.task_submissions;
create policy task_submissions_owner_delete
  on public.task_submissions
  for delete
  to authenticated
  using (
    is_platform_admin()
    or student_id = (select auth.uid())
  );
