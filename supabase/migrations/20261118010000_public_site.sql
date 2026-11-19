-- =========================================================================
-- The public site: editable content, the editorial catalog and the
-- login audit trail.
-- -------------------------------------------------------------------------
-- Three things live here:
--
--   site_content             the copy of the landing, editable by the
--                            platform team without a redeploy. One row
--                            per page ("landing").
--   catalog_items            the editorial catalog: the material the
--                            platform team publishes, and the schools
--                            it is enabled for.
--   login_attempts           every sign-in attempt, for the audit trail
--                            and for the rate limit.
--
-- The schools of the catalog are stored as display names, not as
-- foreign keys to `public.schools`: publishing a client name is an
-- explicit act of the platform team, never a side effect of enabling
-- access for a real tenant.
--
-- Rollback:
--   drop table if exists public.login_attempts;
--   drop table if exists public.catalog_item_schools;
--   drop table if exists public.catalog_items;
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
-- The editorial catalog
-- ---------------------------------------------------------------------------
create table if not exists public.catalog_items (
  id         uuid primary key default gen_random_uuid(),
  ref        text not null,
  title      text not null,
  meta       text,
  area       text not null,
  state      text not null,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_items_ref_uq unique (ref),
  constraint catalog_items_state_check
    check (state in ('published', 'review', 'draft', 'archived'))
);

comment on table public.catalog_items is
  'The material the platform team publishes to the editorial catalog.';

create index if not exists catalog_items_position_idx
  on public.catalog_items (position);

create index if not exists catalog_items_state_idx
  on public.catalog_items (state);

drop trigger if exists catalog_items_set_updated_at on public.catalog_items;
create trigger catalog_items_set_updated_at
  before update on public.catalog_items
  for each row execute function public.set_updated_at();

create table if not exists public.catalog_item_schools (
  id              uuid primary key default gen_random_uuid(),
  catalog_item_id uuid not null references public.catalog_items(id) on delete cascade,
  -- The published name of the school. It is a name, not a reference:
  -- what the site shows is decided by the platform team.
  school_name     text not null,
  position        integer not null default 0
);

comment on table public.catalog_item_schools is
  'The schools with access to a catalog item, as they are published.';

create index if not exists catalog_item_schools_item_idx
  on public.catalog_item_schools (catalog_item_id);

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
-- `public` is exposed by PostgREST. These tables hold the editable
-- content of the site and the audit trail of the sign-ins, so nobody
-- holding an `anon` or `authenticated` token may read or write them:
-- only the backend, which connects with the owner role, can.
-- ---------------------------------------------------------------------------
alter table public.site_content enable row level security;
alter table public.catalog_items enable row level security;
alter table public.catalog_item_schools enable row level security;
alter table public.login_attempts enable row level security;

-- ---------------------------------------------------------------------------
-- A locked account cannot sign in until the lock expires.
-- ---------------------------------------------------------------------------
alter table public.users add column if not exists locked_until timestamptz;

comment on column public.users.locked_until is
  'While set, the account is locked and sign-in answers 423. Null means the account is not locked.';
