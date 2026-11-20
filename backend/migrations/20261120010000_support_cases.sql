-- =========================================================================
-- The support desk of the platform role.
-- -------------------------------------------------------------------------
-- What reaches the platform team from the schools is not a log line but
-- a case: someone asks for something, the team answers, and the whole
-- conversation stays written down.
--
--   support_cases      the case itself: what was asked, who asked it,
--                      through which channel and how urgent it is.
--   support_messages   the conversation, one message per turn.
--
-- The `schools.city` column is added here because the platform team
-- registers the institutions of the network and the city is part of
-- that registration. It is optional: a school that does not report it
-- simply does not show it.
--
-- The rules of a case live in the code, not in the database: the levels
-- are "info", "warning" and "urgent", and the states are "open",
-- "waiting" and "resolved".
--
-- Rollback:
--   drop table if exists public.support_messages;
--   drop table if exists public.support_cases;
--   alter table public.schools drop column if exists city;
-- =========================================================================


-- ---------------------------------------------------------------------------
-- The city of the school
-- ---------------------------------------------------------------------------
alter table public.schools add column if not exists city text;

comment on column public.schools.city is
  'The city where the school is, reported when it is registered.';


-- ---------------------------------------------------------------------------
-- The cases
-- ---------------------------------------------------------------------------
create table if not exists public.support_cases (
  id             uuid primary key default gen_random_uuid(),
  -- The readable identifier the support team uses: "SOL-1042".
  code           varchar(12) not null,
  -- What the school asked, in one line.
  subject        varchar(240) not null,
  -- The longer description of the case, as it was reported.
  detail         text,
  school_id      uuid references public.schools(id) on delete set null,
  -- Who asked and what they do in the school.
  requester_name varchar(160) not null,
  requester_role varchar(80) not null,
  -- How the case arrived: "web_form", "email" or "call".
  channel        varchar(32) not null default 'web_form',
  -- "info", "warning" or "urgent".
  level          varchar(16) not null default 'info',
  -- "open", "waiting" or "resolved".
  status         varchar(16) not null default 'open',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  constraint support_cases_code_uq unique (code),
  constraint support_cases_channel_check
    check (channel in ('web_form', 'email', 'call')),
  constraint support_cases_level_check
    check (level in ('info', 'warning', 'urgent')),
  constraint support_cases_status_check
    check (status in ('open', 'waiting', 'resolved'))
);

comment on table public.support_cases is
  'A case the platform team answers for the schools of the network.';

create index if not exists support_cases_status_idx
  on public.support_cases (status);

create index if not exists support_cases_level_idx
  on public.support_cases (level);

create index if not exists support_cases_school_idx
  on public.support_cases (school_id);

create index if not exists support_cases_created_at_idx
  on public.support_cases (created_at desc);

drop trigger if exists support_cases_set_updated_at on public.support_cases;
create trigger support_cases_set_updated_at
  before update on public.support_cases
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- The conversation
-- ---------------------------------------------------------------------------
create table if not exists public.support_messages (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references public.support_cases(id) on delete cascade,
  -- The author of the message. It is null when the account was
  -- removed, but the name of the author stays written down.
  author_id   uuid references public.users(id) on delete set null,
  author_name varchar(160) not null,
  -- What the author does: "Teacher", "Principal", "Platform"...
  author_role varchar(80) not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

comment on table public.support_messages is
  'One turn of the conversation of a support case.';

create index if not exists support_messages_case_idx
  on public.support_messages (case_id, created_at);

-- The platform tables are closed by default: the API is the one that
-- decides who reads them.
alter table public.support_cases enable row level security;
alter table public.support_messages enable row level security;
