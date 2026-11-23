-- =========================================================================
-- public.notifications: the in-app notifications of each user.
-- -------------------------------------------------------------------------
-- A notification is addressed to one user (`recipient_user_id`) inside a
-- school. The `kind` says what happened, `title` and `body` say it in
-- words, and `link` points at the place in the app where the user can
-- act on it. `payload` carries the ids of the records involved, so the
-- frontend does not have to guess what the notification is about.
--
-- The rows are written by the backend, never by the browser: the domain
-- modules create them when a task is posted, a submission arrives, a
-- submission is graded, content is published or a chat message is sent.
--
-- RLS is enabled with no policies, like `public.users` and the session
-- tables: the backend connects with the owner role and bypasses RLS, so
-- the API is the only way in. A notification is personal data, and the
-- browser must not be able to read somebody else's.
-- =========================================================================

create type notification_kind as enum (
  'task_assigned',
  'task_submitted',
  'task_graded',
  'content_published',
  'chat_message'
);

create table if not exists public.notifications (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  recipient_user_id uuid not null references public.users(id) on delete cascade,
  kind              notification_kind not null,
  title             text not null,
  body              text,
  link              text,
  payload           jsonb not null default '{}'::jsonb,
  read_at           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint notifications_title_check check (length(btrim(title)) > 0)
);

comment on table public.notifications is
  'The in-app notifications of a user. One row per event addressed to one recipient. '
  'A row with read_at set has been seen; a null read_at means it is still unread.';

-- The list the bell panel opens: the notifications of one user, newest
-- first. The recipient is the equality column and created_at carries the
-- sort, so the index answers the query without a sort step.
create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);

-- The unread counter and the "only unread" filter. A partial index keeps
-- it small: read notifications are the majority once the user works
-- through their bell.
create index if not exists notifications_unread_idx
  on public.notifications (recipient_user_id, created_at desc)
  where read_at is null;

-- The tenant column. Every school-scoped table carries it, and the
-- foreign key needs a covering index.
create index if not exists notifications_school_id_idx
  on public.notifications (school_id);

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at
  before update on public.notifications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS, with no policies
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;
