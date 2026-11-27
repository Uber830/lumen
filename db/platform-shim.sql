-- =========================================================================
-- Local Postgres shim for the objects the inherited migrations expect.
-- -------------------------------------------------------------------------
-- The Lumen migrations inherited from the original project assume a few
-- platform objects that a plain Postgres container does not have:
--
--   - the `auth` schema, holding `auth.users` (the identity table);
--   - the `authenticated`, `anon` and `service_role` roles, used by the
--     RLS policies.
--
-- They are not available in a plain Postgres container. This script
-- creates stand-ins so the migrations can be applied to a local
-- database, which is what the CI pipeline and the migration-drift
-- check use.
--
-- It is not part of the schema the application uses: it only holds the
-- objects the inherited migrations reference, so that they can be
-- applied to a plain Postgres.
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
