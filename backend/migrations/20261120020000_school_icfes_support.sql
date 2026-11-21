-- =========================================================================
-- The simulators of the platform and the channel with the support team.
-- -------------------------------------------------------------------------
-- The ICFES simulators live in three layers, and each one has a single
-- owner:
--
--   icfes_simulators          the catalog of the platform team. It writes
--                             here; the school never does.
--   icfes_simulator_schools   who has each simulator. The platform team
--                             enables it for a school; the school cannot
--                             enable or disable it.
--   icfes_activations         what the school does with what it received:
--                             in which courses the simulator runs and until
--                             when. One row per course.
--
-- The channel with the support team is the other half of the day to day
-- of a school administrator:
--
--   support_cases   the requests the school opens, with their state.
--   support_messages  the thread of each case, in the same order.
--
-- The `school_id` always comes from the session token: the client never
-- sends it.
--
-- Rollback:
--   drop table if exists public.support_messages;
--   drop table if exists public.support_cases;
--   drop table if exists public.icfes_activations;
--   drop table if exists public.icfes_simulator_schools;
--   drop table if exists public.icfes_simulators;
-- =========================================================================

-- ---------------------------------------------------------------------------
-- The catalog of simulators
--
-- The simulator is the exam the platform team prepares: its code, the
-- grade it is for, how many questions it has and how long it takes. The
-- `average_score` stays null until the simulation is corrected, and the
-- scale of the exam is the 0-500 one the module already uses.
-- ---------------------------------------------------------------------------
create table if not exists public.icfes_simulators (
  id             uuid primary key default gen_random_uuid(),
  -- The short code shown in the tables: SIM-2026-2-S7.
  code           text not null,
  name           text not null,
  grade          text not null,
  question_count integer not null default 0,
  duration_min   integer not null default 0,
  scheduled_at   date,
  -- borrador, en_revision, publicado, en_curso, cerrado or archivado.
  status         text not null default 'borrador',
  -- The average of the school. Null until the exam is corrected.
  average_score  numeric(6,2),
  -- The exam the students take. It links to the simulation the platform
  -- team assembles, so the results are the ones of a real run.
  simulation_id  uuid references public.icfes_simulations(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint icfes_simulators_code_uq unique (code),
  constraint icfes_simulators_status_ck
    check (status in ('borrador', 'en_revision', 'publicado', 'en_curso', 'cerrado', 'archivado')),
  constraint icfes_simulators_question_count_ck check (question_count > 0),
  constraint icfes_simulators_duration_ck check (duration_min > 0),
  constraint icfes_simulators_average_score_ck
    check (average_score is null or average_score between 0 and 500)
);

comment on table public.icfes_simulators is
  'The catalog of ICFES simulators. It belongs to the platform team.';

create index if not exists icfes_simulators_status_idx on public.icfes_simulators (status);
create index if not exists icfes_simulators_grade_idx on public.icfes_simulators (grade);

drop trigger if exists icfes_simulators_set_updated_at on public.icfes_simulators;
create trigger icfes_simulators_set_updated_at
  before update on public.icfes_simulators
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Which school has each simulator
--
-- The platform team enables a simulator for a school. The school only
-- reads this table: it cannot enable or disable a simulator, and a
-- simulator that is not here does not exist for that school.
-- ---------------------------------------------------------------------------
create table if not exists public.icfes_simulator_schools (
  id          uuid primary key default gen_random_uuid(),
  simulator_id uuid not null references public.icfes_simulators(id) on delete cascade,
  school_id    uuid not null references public.schools(id) on delete cascade,
  enabled_at   timestamptz not null default now(),
  enabled_by   uuid references public.users(id) on delete set null,
  constraint icfes_simulator_schools_uq unique (simulator_id, school_id)
);

comment on table public.icfes_simulator_schools is
  'The schools with a simulator. The platform team enables it; the school cannot.';

create index if not exists icfes_simulator_schools_school_idx
  on public.icfes_simulator_schools (school_id);

-- ---------------------------------------------------------------------------
-- What the school does with the simulator
--
-- The school activates the simulator course by course and sets the
-- deadline of each one. One row per course: the same simulator can run
-- in three courses with three deadlines.
-- ---------------------------------------------------------------------------
create table if not exists public.icfes_activations (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  simulator_id uuid not null references public.icfes_simulators(id) on delete cascade,
  course_id    uuid not null references public.courses(id) on delete cascade,
  deadline     date not null,
  activated_at timestamptz not null default now(),
  constraint icfes_activations_uq unique (school_id, simulator_id, course_id)
);

comment on table public.icfes_activations is
  'The courses of the school where a simulator runs, and the deadline of each one.';

create index if not exists icfes_activations_school_idx on public.icfes_activations (school_id);
create index if not exists icfes_activations_course_idx on public.icfes_activations (course_id);

-- ---------------------------------------------------------------------------
-- The requests of the school to the support team
--
-- The case is opened by the school and answered by the platform team in
-- the same thread. The school does not close a case: that is the
-- platform team's decision.
-- ---------------------------------------------------------------------------
create table if not exists public.support_cases (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  -- The short code shown in the tables: SOL-1043.
  code       text not null,
  title      text not null,
  -- problema_tecnico, solicitud_material, duda_acceso or otro.
  category   text not null default 'otro',
  -- formulario_colegio, formulario_web, correo or llamada.
  channel    text not null default 'formulario_colegio',
  -- info, aviso or urgente.
  level      text not null default 'info',
  -- abierto, en_espera or resuelto.
  status     text not null default 'abierto',
  opened_by  uuid references public.users(id) on delete set null,
  opened_at  timestamptz not null default now(),
  resolved_at timestamptz,
  constraint support_cases_code_uq unique (code),
  constraint support_cases_category_ck
    check (category in ('problema_tecnico', 'solicitud_material', 'duda_acceso', 'otro')),
  constraint support_cases_channel_ck
    check (channel in ('formulario_colegio', 'formulario_web', 'correo', 'llamada')),
  constraint support_cases_level_ck check (level in ('info', 'aviso', 'urgente')),
  constraint support_cases_status_ck check (status in ('abierto', 'en_espera', 'resuelto'))
);

comment on table public.support_cases is
  'The requests the school opens to the support team. The school does not resolve them.';

create index if not exists support_cases_school_idx on public.support_cases (school_id);
create index if not exists support_cases_status_idx on public.support_cases (status);

-- ---------------------------------------------------------------------------
-- The thread of a case
--
-- Both sides write in the same thread: the platform team answers and
-- resolves, the school answers and adds information.
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.support_cases(id) on delete cascade,
  author_id   uuid references public.users(id) on delete set null,
  -- colegio or plataforma: who wrote it.
  author_role text not null default 'colegio',
  body        text not null,
  created_at  timestamptz not null default now(),
  constraint support_messages_author_role_ck check (author_role in ('colegio', 'plataforma'))
);

comment on table public.support_messages is
  'The conversation of a case. Both sides write in the same thread.';

create index if not exists support_messages_case_idx on public.support_messages (case_id);

-- ---------------------------------------------------------------------------
-- RLS, with no policies
--
-- The API connects with the owner role, which the policies do not
-- affect. The tables start from a closed door, like the rest of the
-- public schema.
-- ---------------------------------------------------------------------------
alter table public.icfes_simulators enable row level security;
alter table public.icfes_simulator_schools enable row level security;
alter table public.icfes_activations enable row level security;
alter table public.support_cases enable row level security;
alter table public.support_messages enable row level security;
