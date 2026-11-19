-- =========================================================================
-- ICFES scoring tables.
-- =========================================================================

create type icfes_question_kind as enum ('multiple_choice', 'true_false');
create type icfes_attempt_status as enum (
  'in_progress',
  'submitted',
  'graded'
);

create table public.icfes_questions (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  area         text not null,
  grado        text not null,
  difficulty   text not null,
  competencia  text,
  prompt       text not null,
  reading      text,
  options      jsonb not null check (
    jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4
  ),
  points       numeric(5, 2) not null default 1.0 check (points >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index icfes_questions_school_id_idx on public.icfes_questions (school_id);
create index icfes_questions_school_area_idx on public.icfes_questions (school_id, area);

create trigger icfes_questions_set_updated_at
  before update on public.icfes_questions
  for each row execute function public.set_updated_at();

create table public.icfes_answer_keys (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  question_id     uuid not null references public.icfes_questions(id) on delete cascade,
  correct_index   integer not null check (correct_index >= 0 and correct_index <= 3),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint icfes_answer_keys_question_uq unique (question_id)
);

create trigger icfes_answer_keys_set_updated_at
  before update on public.icfes_answer_keys
  for each row execute function public.set_updated_at();

create table public.icfes_simulations (
  id                       uuid primary key default gen_random_uuid(),
  school_id                uuid not null references public.schools(id) on delete cascade,
  course_subject_id        uuid not null references public.course_subjects(id) on delete cascade,
  posted_by                uuid not null references auth.users(id) on delete restrict,
  title                    text not null,
  description              text,
  duration_minutes         integer check (duration_minutes is null or duration_minutes > 0),
  available_from           timestamptz,
  available_until          timestamptz,
  is_published             boolean not null default false,
  randomize_questions      boolean not null default false,
  randomize_options        boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index icfes_simulations_school_id_idx on public.icfes_simulations (school_id);
create index icfes_simulations_course_subject_id_idx
  on public.icfes_simulations (course_subject_id);

create trigger icfes_simulations_set_updated_at
  before update on public.icfes_simulations
  for each row execute function public.set_updated_at();

create table public.icfes_simulation_questions (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  simulation_id   uuid not null references public.icfes_simulations(id) on delete cascade,
  question_id     uuid not null references public.icfes_questions(id) on delete restrict,
  position        integer not null check (position > 0),
  created_at      timestamptz not null default now(),
  constraint icfes_simulation_questions_position_uq unique (simulation_id, position),
  constraint icfes_simulation_questions_question_uq unique (simulation_id, question_id)
);

create index icfes_simulation_questions_simulation_id_idx
  on public.icfes_simulation_questions (simulation_id);

create table public.icfes_attempts (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  simulation_id    uuid not null references public.icfes_simulations(id) on delete cascade,
  student_id       uuid not null references auth.users(id) on delete cascade,
  status           icfes_attempt_status not null default 'in_progress',
  started_at       timestamptz not null default now(),
  submitted_at     timestamptz,
  graded_at        timestamptz,
  global_score     numeric(6, 2),
  max_score        numeric(6, 2),
  percent          numeric(5, 2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint icfes_attempts_sim_student_uq unique (simulation_id, student_id)
);

create index icfes_attempts_school_id_idx on public.icfes_attempts (school_id);
create index icfes_attempts_simulation_id_idx on public.icfes_attempts (simulation_id);
create index icfes_attempts_student_id_idx on public.icfes_attempts (student_id);

create trigger icfes_attempts_set_updated_at
  before update on public.icfes_attempts
  for each row execute function public.set_updated_at();

create table public.icfes_answers (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools(id) on delete cascade,
  attempt_id      uuid not null references public.icfes_attempts(id) on delete cascade,
  question_id     uuid not null references public.icfes_questions(id) on delete restrict,
  chosen_index    integer check (chosen_index is null or (chosen_index >= 0 and chosen_index <= 3)),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint icfes_answers_attempt_question_uq unique (attempt_id, question_id)
);

create index icfes_answers_attempt_id_idx on public.icfes_answers (attempt_id);

create trigger icfes_answers_set_updated_at
  before update on public.icfes_answers
  for each row execute function public.set_updated_at();

create table public.icfes_scores (
  attempt_id  uuid primary key references public.icfes_attempts(id) on delete cascade,
  school_id   uuid not null references public.schools(id) on delete cascade,
  area        text not null,
  correct     integer not null default 0,
  total       integer not null default 0,
  percent     numeric(5, 2) not null default 0,
  updated_at  timestamptz not null default now(),
  constraint icfes_scores_attempt_area_uq unique (attempt_id, area)
);

create index icfes_scores_school_id_idx on public.icfes_scores (school_id);

create trigger icfes_scores_set_updated_at
  before update on public.icfes_scores
  for each row execute function public.set_updated_at();

alter table public.icfes_questions enable row level security;
alter table public.icfes_answer_keys enable row level security;
alter table public.icfes_simulations enable row level security;
alter table public.icfes_simulation_questions enable row level security;
alter table public.icfes_attempts enable row level security;
alter table public.icfes_answers enable row level security;
alter table public.icfes_scores enable row level security;

drop policy if exists icfes_questions_select on public.icfes_questions;
create policy icfes_questions_select
  on public.icfes_questions
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(
          school_id,
          (select course_subject_id from public.icfes_simulations where id = (select simulation_id from public.icfes_simulation_questions where question_id = icfes_questions.id limit 1))
        ))
    or exists (
      select 1
      from public.icfes_simulation_questions sq
      join public.icfes_simulations s on s.id = sq.simulation_id
      where sq.question_id = icfes_questions.id
        and s.is_published
        and (select public.school_has_icfes(icfes_questions.school_id))
        and (select public.is_course_student(
              icfes_questions.school_id,
              (select course_id from public.course_subjects where id = s.course_subject_id)
            ))
    )
  );

drop policy if exists icfes_questions_teacher_write on public.icfes_questions;
create policy icfes_questions_teacher_write
  on public.icfes_questions
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );

drop policy if exists icfes_questions_teacher_update on public.icfes_questions;
create policy icfes_questions_teacher_update
  on public.icfes_questions
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

drop policy if exists icfes_questions_teacher_delete on public.icfes_questions;
create policy icfes_questions_teacher_delete
  on public.icfes_questions
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );

drop policy if exists icfes_answer_keys_select on public.icfes_answer_keys;
create policy icfes_answer_keys_select
  on public.icfes_answer_keys
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );

drop policy if exists icfes_answer_keys_teacher_write on public.icfes_answer_keys;
create policy icfes_answer_keys_teacher_write
  on public.icfes_answer_keys
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );

drop policy if exists icfes_answer_keys_teacher_update on public.icfes_answer_keys;
create policy icfes_answer_keys_teacher_update
  on public.icfes_answer_keys
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

drop policy if exists icfes_answer_keys_teacher_delete on public.icfes_answer_keys;
create policy icfes_answer_keys_teacher_delete
  on public.icfes_answer_keys
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
  );

drop policy if exists icfes_simulations_select on public.icfes_simulations;
create policy icfes_simulations_select
  on public.icfes_simulations
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or (
      is_published
      and (select public.school_has_icfes(school_id))
      and (select public.is_course_student(
            school_id,
            (select course_id from public.course_subjects where id = course_subject_id)
          ))
    )
  );

drop policy if exists icfes_simulations_teacher_write on public.icfes_simulations;
create policy icfes_simulations_teacher_write
  on public.icfes_simulations
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists icfes_simulations_teacher_update on public.icfes_simulations;
create policy icfes_simulations_teacher_update
  on public.icfes_simulations
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

drop policy if exists icfes_simulations_teacher_delete on public.icfes_simulations;
create policy icfes_simulations_teacher_delete
  on public.icfes_simulations
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists icfes_simulation_questions_select on public.icfes_simulation_questions;
create policy icfes_simulation_questions_select
  on public.icfes_simulation_questions
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.icfes_simulations where id = simulation_id)))
    or exists (
      select 1
      from public.icfes_simulations s
      where s.id = icfes_simulation_questions.simulation_id
        and s.is_published
        and (select public.school_has_icfes(school_id))
        and (select public.is_course_student(
              school_id,
              (select course_id from public.course_subjects where id = s.course_subject_id)
            ))
    )
  );

drop policy if exists icfes_simulation_questions_teacher_write on public.icfes_simulation_questions;
create policy icfes_simulation_questions_teacher_write
  on public.icfes_simulation_questions
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.icfes_simulations where id = simulation_id)))
  );

drop policy if exists icfes_simulation_questions_teacher_delete on public.icfes_simulation_questions;
create policy icfes_simulation_questions_teacher_delete
  on public.icfes_simulation_questions
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.icfes_simulations where id = simulation_id)))
  );

drop policy if exists icfes_attempts_select on public.icfes_attempts;
create policy icfes_attempts_select
  on public.icfes_attempts
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.icfes_simulations where id = simulation_id)))
    or student_id = (select auth.uid())
  );

drop policy if exists icfes_attempts_student_write on public.icfes_attempts;
create policy icfes_attempts_student_write
  on public.icfes_attempts
  for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
    and exists (
      select 1
      from public.icfes_simulations s
      where s.id = simulation_id
        and s.school_id = school_id
        and s.is_published
        and (select public.school_has_icfes(school_id))
    )
  );

drop policy if exists icfes_attempts_student_update on public.icfes_attempts;
create policy icfes_attempts_student_update
  on public.icfes_attempts
  for update
  to authenticated
  using (
    student_id = (select auth.uid())
  )
  with check (
    student_id = (select auth.uid())
  );

drop policy if exists icfes_attempts_teacher_update on public.icfes_attempts;
create policy icfes_attempts_teacher_update
  on public.icfes_attempts
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.icfes_simulations where id = simulation_id)))
  )
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.icfes_simulations where id = simulation_id)))
  );

drop policy if exists icfes_answers_select on public.icfes_answers;
create policy icfes_answers_select
  on public.icfes_answers
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select s.course_subject_id from public.icfes_simulations s where s.id = (select simulation_id from public.icfes_attempts where id = attempt_id))))
    or (select student_id from public.icfes_attempts where id = attempt_id) = (select auth.uid())
  );

drop policy if exists icfes_answers_student_write on public.icfes_answers;
create policy icfes_answers_student_write
  on public.icfes_answers
  for insert
  to authenticated
  with check (
    (select student_id from public.icfes_attempts where id = attempt_id) = (select auth.uid())
    and (select status from public.icfes_attempts where id = attempt_id) = 'in_progress'
  );

drop policy if exists icfes_answers_student_update on public.icfes_answers;
create policy icfes_answers_student_update
  on public.icfes_answers
  for update
  to authenticated
  using (
    (select student_id from public.icfes_attempts where id = attempt_id) = (select auth.uid())
    and (select status from public.icfes_attempts where id = attempt_id) = 'in_progress'
  )
  with check (
    (select student_id from public.icfes_attempts where id = attempt_id) = (select auth.uid())
    and (select status from public.icfes_attempts where id = attempt_id) = 'in_progress'
  );

drop policy if exists icfes_scores_select on public.icfes_scores;
create policy icfes_scores_select
  on public.icfes_scores
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(icfes_scores.school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(
          icfes_scores.school_id,
          (select s.course_subject_id
             from public.icfes_simulations s
            where s.id = (select simulation_id
                            from public.icfes_attempts
                           where id = icfes_scores.attempt_id)
          )
        ))
    or (select student_id from public.icfes_attempts where id = attempt_id) = (select auth.uid())
  );

drop policy if exists icfes_scores_service_write on public.icfes_scores;
create policy icfes_scores_service_write
  on public.icfes_scores
  for insert
  to authenticated
  with check (is_platform_admin());

drop policy if exists icfes_scores_service_update on public.icfes_scores;
create policy icfes_scores_service_update
  on public.icfes_scores
  for update
  to authenticated
  using (is_platform_admin())
  with check (is_platform_admin());
