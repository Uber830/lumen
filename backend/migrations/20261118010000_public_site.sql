-- =========================================================================
-- The public site: editable content and the login audit trail.
-- -------------------------------------------------------------------------
-- Two things live here:
--
--   site_content             the copy of the landing, editable by the
--                            platform team without a redeploy. One row
--                            per page ("landing").
--   login_attempts           every sign-in attempt, for the audit trail
--                            and for the rate limit.
--
-- The editorial catalog used to live here as `catalog_items` and
-- `catalog_item_schools`. It moved to its own model (materials,
-- material_files, material_schools) in
-- `20261119010000_editorial_catalog.sql`, which transforms the rows of
-- the old tables and drops them. The catalog is not created here
-- anymore: a fresh database gets it straight in its final shape.
--
-- Rollback:
--   drop table if exists public.login_attempts;
--   drop table if exists public.site_content;
--   alter table public.users drop column if exists locked_until;
-- =========================================================================

-- ---------------------------------------------------------------------------
-- The editable content of the public site
-- ---------------------------------------------------------------------------
create table if not exists public.site_content (
  key        text primary key,
  content    jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.site_content is
  'The editable content of the public site. One row per page. The API serves it as JSON.';

drop trigger if exists site_content_set_updated_at on public.site_content;
create trigger site_content_set_updated_at
  before update on public.site_content
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- The login audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.login_attempts (
  id         uuid primary key default gen_random_uuid(),
  -- The SHA-256 (HMAC) of the email, never the email itself.
  email_hash text not null,
  ip_address text,
  outcome    text not null,
  created_at timestamptz not null default now()
);

comment on table public.login_attempts is
  'Every sign-in attempt, with the email hashed. Feeds the rate limit and the audit trail.';

create index if not exists login_attempts_email_created_idx
  on public.login_attempts (email_hash, created_at desc);

create index if not exists login_attempts_created_idx
  on public.login_attempts (created_at desc);

-- ---------------------------------------------------------------------------
-- RLS, with no policies
--
-- The tables hold the editable content of the site and the audit trail
-- of the sign-ins. Row level security is enabled on all of them, so
-- that a table that later gets a policy starts from a closed door
-- instead of an open one. The API connects with the owner role, which
-- is not affected by the policies.
-- ---------------------------------------------------------------------------
alter table public.site_content enable row level security;
alter table public.login_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- A locked account cannot sign in until the lock expires.
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists locked_until timestamptz;

comment on column public.users.locked_until is
  'While set, the account is locked and sign-in answers 423. Null means the account is not locked.';
