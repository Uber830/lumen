-- =========================================================================
-- public.notification_preferences: what each user wants to be told, and how.
-- -------------------------------------------------------------------------
-- One row per (user, kind). The row says whether the notification shows
-- up inside the app (`in_app`) and whether it is worth sending by email
-- (`email`).
--
-- A user without a row gets the defaults: everything inside the app,
-- nothing by email. The defaults live in the code, not in the database:
-- a missing row is the default, and the API fills it in.
--
-- The preferences are personal, not tenant scoped: they say what the
-- user wants to hear about, not what a school wants to tell them. A
-- user who belongs to two schools keeps the same preferences in both.
--
-- The `email` column is the preference for a channel that does not
-- exist yet: no mail provider is configured in this repository. The
-- column is here so the preference is already where the provider will
-- look for it.
-- =========================================================================

create table if not exists public.notification_preferences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  kind       notification_kind not null,
  in_app     boolean not null default true,
  email      boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_preferences_user_kind_uq unique (user_id, kind)
);

comment on table public.notification_preferences is
  'What a user wants to be told about, and how. One row per (user, kind); '
  'a missing row means the defaults: in the app, and not by email.';

-- The unique constraint already indexes (user_id, kind), which is the
-- lookup the service does when it decides who to notify.

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS, with no policies
-- ---------------------------------------------------------------------------
-- The preferences are personal: only the API reads and writes them.
alter table public.notification_preferences enable row level security;
