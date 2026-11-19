-- =========================================================================
-- evaluations and grading tables (non-ICFES).
-- -------------------------------------------------------------------------
-- Each course_subject can host one or more evaluations (quizzes, exams).
-- The questions are readable by any school member; the answer keys live
-- in a separate table that only teachers and school_admin can read. The
-- student submits an attempt, which is graded by a teacher (or
-- auto-graded for closed questions when finalized via the backend in
-- commit 5 of Fase 6).
-- =========================================================================

create type evaluation_kind as enum ('multiple_choice', 'true_false', 'open');
create type evaluation_attempt_status as enum (
  'in_progress',
  'submitted',
  'graded',
  'expired'
);

create table public.evaluations (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  course_subject_id  uuid not null references public.course_subjects(id) on delete cascade,
  posted_by          uuid not null references auth.users(id) on delete restrict,
  title              text not null,
  description        text,
  duration_minutes   integer check (duration_minutes is null or duration_minutes > 0),
  due_at             timestamptz,
  is_published       boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index evaluations_school_id_idx on public.evaluations (school_id);
create index evaluations_course_subject_id_idx on public.evaluations (course_subject_id);

comment on table public.evaluations is
  'A teacher-posted evaluation. is_published gates student visibility.';

create trigger evaluations_set_updated_at
  before update on public.evaluations
  for each row execute function public.set_updated_at();

create table public.evaluation_questions (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  evaluation_id   uuid not null references public.evaluations(id) on delete cascade,
  position        integer not null check (position > 0),
  kind            evaluation_kind not null,
  prompt          text not null,
  -- For multiple_choice: array of 4 strings.
  -- For true_false: ignored.
  -- For open: ignored.
  options         jsonb,
  points          numeric(5, 2) not null default 1.0 check (points >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint evaluation_questions_position_uq unique (evaluation_id, position),
  constraint evaluation_questions_options_shape_ck check (
    (kind = 'multiple_choice' and options is not null and jsonb_typeof(options) = 'array' and jsonb_array_length(options) >= 2) or
    (kind <> 'multiple_choice')
  )
);

create index evaluation_questions_evaluation_id_idx on public.evaluation_questions (evaluation_id);

comment on table public.evaluation_questions is
  'The question prompt and (for multiple_choice) options. Correct answers live in evaluation_answer_keys which only teachers and admins can read.';

create trigger evaluation_questions_set_updated_at
  before update on public.evaluation_questions
  for each row execute function public.set_updated_at();

create table public.evaluation_answer_keys (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  evaluation_id   uuid not null references public.evaluations(id) on delete cascade,
  question_id     uuid not null references public.evaluation_questions(id) on delete cascade,
  -- For multiple_choice: the index in evaluation_questions.options (0..n).
  -- For true_false: a boolean.
  -- For open: a model answer (text) the grader can compare against.
  closed_answer   integer,
  closed_boolean  boolean,
  model_answer    text,
  points          numeric(5, 2) not null default 1.0 check (points >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint evaluation_answer_keys_question_uq unique (question_id),
  constraint evaluation_answer_keys_shape_ck check (
    (closed_answer is not null)::int +
    (closed_boolean is not null)::int +
    (model_answer is not null)::int = 1
  )
);

comment on table public.evaluation_answer_keys is
  'Closed answer or model answer per question. Read-restricted to teachers and admins by RLS.';

create trigger evaluation_answer_keys_set_updated_at
  before update on public.evaluation_answer_keys
  for each row execute function public.set_updated_at();

create table public.evaluation_attempts (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  evaluation_id   uuid not null references public.evaluations(id) on delete cascade,
  student_id      uuid not null references auth.users(id) on delete cascade,
  status          evaluation_attempt_status not null default 'in_progress',
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  graded_at       timestamptz,
  score           numeric(6, 2),
  max_score       numeric(6, 2),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint evaluation_attempts_eval_student_uq unique (evaluation_id, student_id)
);

create index evaluation_attempts_school_id_idx on public.evaluation_attempts (school_id);
create index evaluation_attempts_evaluation_id_idx on public.evaluation_attempts (evaluation_id);
create index evaluation_attempts_student_id_idx on public.evaluation_attempts (student_id);

comment on table public.evaluation_attempts is
  'One attempt per (evaluation, student). Created when the student starts; finalized and graded by the backend.';

create trigger evaluation_attempts_set_updated_at
  before update on public.evaluation_attempts
  for each row execute function public.set_updated_at();

create table public.evaluation_answers (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  attempt_id      uuid not null references public.evaluation_attempts(id) on delete cascade,
  question_id     uuid not null references public.evaluation_questions(id) on delete cascade,
  -- For multiple_choice: the chosen option index (or null if skipped).
  -- For true_false: the chosen boolean (or null).
  -- For open: free-text.
  closed_answer   integer,
  closed_boolean  boolean,
  text_answer     text,
  points_awarded  numeric(5, 2),
  graded_by       uuid references auth.users(id),
  graded_at       timestamptz,
  feedback        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint evaluation_answers_attempt_question_uq unique (attempt_id, question_id),
  constraint evaluation_answers_shape_ck check (
    (closed_answer is not null)::int +
    (closed_boolean is not null)::int +
    (text_answer is not null)::int = 1
  )
);

comment on table public.evaluation_answers is
  'One answer per (attempt, question). Students write their own; teachers update graded_* fields.';

create trigger evaluation_answers_set_updated_at
  before update on public.evaluation_answers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.evaluations enable row level security;
alter table public.evaluation_questions enable row level security;
alter table public.evaluation_answer_keys enable row level security;
alter table public.evaluation_attempts enable row level security;
alter table public.evaluation_answers enable row level security;

-- evaluations: any school member can read published; teacher of the
-- course_subject writes; school_admin also writes.
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select
  on public.evaluations
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or (
      is_published
      and (select public.is_course_student(
        school_id,
        (select course_id from public.course_subjects where id = course_subject_id)
      ))
    )
  );

drop policy if exists evaluations_teacher_write on public.evaluations;
create policy evaluations_teacher_write
  on public.evaluations
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists evaluations_teacher_update on public.evaluations;
create policy evaluations_teacher_update
  on public.evaluations
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or posted_by = (select auth.uid())
  )
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists evaluations_teacher_delete on public.evaluations;
create policy evaluations_teacher_delete
  on public.evaluations
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

-- evaluation_questions: same access as the parent evaluation
drop policy if exists evaluation_questions_select on public.evaluation_questions;
create policy evaluation_questions_select
  on public.evaluation_questions
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
    or exists (
      select 1 from public.evaluations e
      where e.id = evaluation_questions.evaluation_id
        and e.is_published
        and (select public.is_course_student(
              e.school_id,
              (select course_id from public.course_subjects where id = e.course_subject_id)
            ))
    )
  );

drop policy if exists evaluation_questions_teacher_write on public.evaluation_questions;
create policy evaluation_questions_teacher_write
  on public.evaluation_questions
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

drop policy if exists evaluation_questions_teacher_update on public.evaluation_questions;
create policy evaluation_questions_teacher_update
  on public.evaluation_questions
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  )
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

drop policy if exists evaluation_questions_teacher_delete on public.evaluation_questions;
create policy evaluation_questions_teacher_delete
  on public.evaluation_questions
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

-- evaluation_answer_keys: read and write by teacher of course_subject
-- or school_admin only. Students NEVER see this table.
drop policy if exists evaluation_answer_keys_select on public.evaluation_answer_keys;
create policy evaluation_answer_keys_select
  on public.evaluation_answer_keys
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

drop policy if exists evaluation_answer_keys_teacher_write on public.evaluation_answer_keys;
create policy evaluation_answer_keys_teacher_write
  on public.evaluation_answer_keys
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

drop policy if exists evaluation_answer_keys_teacher_update on public.evaluation_answer_keys;
create policy evaluation_answer_keys_teacher_update
  on public.evaluation_answer_keys
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  )
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

drop policy if exists evaluation_answer_keys_teacher_delete on public.evaluation_answer_keys;
create policy evaluation_answer_keys_teacher_delete
  on public.evaluation_answer_keys
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

-- evaluation_attempts: students read/write their own; teachers and admins
-- read all.
drop policy if exists evaluation_attempts_select on public.evaluation_attempts;
create policy evaluation_attempts_select
  on public.evaluation_attempts
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
    or student_id = (select auth.uid())
  );

drop policy if exists evaluation_attempts_student_write on public.evaluation_attempts;
create policy evaluation_attempts_student_write
  on public.evaluation_attempts
  for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.evaluations e
      where e.id = evaluation_id
        and e.school_id = school_id
        and e.is_published
    )
  );

drop policy if exists evaluation_attempts_student_update on public.evaluation_attempts;
create policy evaluation_attempts_student_update
  on public.evaluation_attempts
  for update
  to authenticated
  using (
    student_id = (select auth.uid())
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  )
  with check (
    student_id = (select auth.uid())
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.evaluations where id = evaluation_id)))
  );

-- evaluation_answers: students write their own (only for in_progress
-- attempts); teachers update graded_* fields; everyone reads as above.
drop policy if exists evaluation_answers_select on public.evaluation_answers;
create policy evaluation_answers_select
  on public.evaluation_answers
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select e.course_subject_id from public.evaluations e where e.id = (select evaluation_id from public.evaluation_attempts where id = attempt_id))))
    or (select student_id from public.evaluation_attempts where id = attempt_id) = (select auth.uid())
  );

drop policy if exists evaluation_answers_student_write on public.evaluation_answers;
create policy evaluation_answers_student_write
  on public.evaluation_answers
  for insert
  to authenticated
  with check (
    (select student_id from public.evaluation_attempts where id = attempt_id) = (select auth.uid())
    and (select status from public.evaluation_attempts where id = attempt_id) = 'in_progress'
  );

drop policy if exists evaluation_answers_student_update on public.evaluation_answers;
create policy evaluation_answers_student_update
  on public.evaluation_answers
  for update
  to authenticated
  using (
    (select student_id from public.evaluation_attempts where id = attempt_id) = (select auth.uid())
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select e.course_subject_id from public.evaluations e where e.id = (select evaluation_id from public.evaluation_attempts where id = attempt_id))))
  )
  with check (
    (select student_id from public.evaluation_attempts where id = attempt_id) = (select auth.uid())
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select e.course_subject_id from public.evaluations e where e.id = (select evaluation_id from public.evaluation_attempts where id = attempt_id))))
  );
