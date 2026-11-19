-- =========================================================================
-- Local Postgres shim for the Supabase platform objects.
-- -------------------------------------------------------------------------
-- The Lumen migrations assume they run inside Supabase, where three
-- platform objects exist:
--
--   - the `auth` schema, holding `auth.users` (the identity table);
--   - the `storage` schema, holding `storage.buckets` and
--     `storage.objects` (Supabase Storage);
--   - the `authenticated` and `anon` roles, used by the RLS policies.
--
-- They are not available in a plain Postgres container. This script
-- creates stand-ins so the migrations can be applied to a local
-- database, which is what the CI pipeline and the migration-drift
-- check use.
--
-- It is NOT part of the Supabase schema: on a real Supabase project
-- the platform provides these objects and this file must not be run.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- The auth schema and its users table
-- ---------------------------------------------------------------------------
create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data  jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- The migrations call `auth.uid()` to identify the caller. In a local
-- database there is no signed-in user, so it returns NULL.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select current_user::text;
$$;

-- ---------------------------------------------------------------------------
-- The storage schema
-- ---------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets(id),
  name       text not null,
  owner      uuid,
  metadata   jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `storage.foldername` returns the path segments of an object name.
-- It is used by the storage policies to scope access to a folder.
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;
