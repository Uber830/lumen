-- =========================================================================
-- Initial tenant schema for Lumen
-- -------------------------------------------------------------------------
-- Tables in this migration are the foundation for multi-tenant isolation.
-- RLS is enabled in the next migration; this one only defines the schema.
-- =========================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type school_role as enum ('school_admin', 'teacher', 'student');

create type platform_role_kind as enum ('platform_admin');

create type school_status as enum ('active', 'trial', 'suspended');

create type plan_interval as enum ('monthly', 'quarterly', 'annual');

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_code  text not null,
  status      school_status not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint schools_name_uq unique (name),
  constraint schools_short_code_uq unique (short_code)
);

comment on table public.schools is
  'Tenant entity. Every academic table in Lumen carries a school_id FK pointing here.';

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  given_name  text,
  family_name text,
  phone       text,
  locale      text not null default 'es-CO',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'User profile data. 1:1 with auth.users. Never store sensitive auth data here.';

-- ---------------------------------------------------------------------------
-- platform_roles
-- ---------------------------------------------------------------------------
create table public.platform_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        platform_role_kind not null,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id)
);

comment on table public.platform_roles is
  'Global roles that are not tied to a particular school. Only platform_admin for now.';

-- ---------------------------------------------------------------------------
-- school_memberships
-- ---------------------------------------------------------------------------
create table public.school_memberships (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        school_role not null,
  is_primary  boolean not null default false,
  joined_at   timestamptz not null default now(),
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint school_memberships_school_user_role_uq unique (school_id, user_id, role)
);

create index school_memberships_user_id_idx on public.school_memberships (user_id);
create index school_memberships_school_id_idx on public.school_memberships (school_id)
  where revoked_at is null;

comment on table public.school_memberships is
  'Joins a user to a school with a specific role. Unique (school, user, role).';

-- Enforce at most one primary membership per (school, user).
create unique index school_memberships_one_primary_per_school_idx
  on public.school_memberships (school_id, user_id)
  where is_primary and revoked_at is null;

-- ---------------------------------------------------------------------------
-- plans
-- ---------------------------------------------------------------------------
create table public.plans (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,
  name          text not null,
  description   text,
  price_cents   integer not null check (price_cents >= 0),
  currency      text not null default 'COP',
  interval      plan_interval not null default 'monthly',
  -- Limits / entitlements are encoded as numeric flags. The exact contract
  -- is owned by the backend; this column is the source of truth.
  max_students  integer,
  max_teachers  integer,
  max_storage_gb integer,
  includes_icfes boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint plans_code_uq unique (code)
);

comment on table public.plans is
  'Catalog of subscription plans. Read-only for regular users; mutated by platform_admin via the backend.';

-- ---------------------------------------------------------------------------
-- updated_at trigger function (reused by future tables)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger school_memberships_set_updated_at
  before update on public.school_memberships
  for each row execute function public.set_updated_at();

create trigger plans_set_updated_at
  before update on public.plans
  for each row execute function public.set_updated_at();
