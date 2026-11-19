-- =========================================================================
-- create the session tables.
-- -------------------------------------------------------------------------
-- The state that Supabase Auth used to keep:
--
--   refresh_tokens           the long-lived tokens the client exchanges
--                            for a new access token
--   password_reset_tokens    single-use tokens for the reset flow
--   email_verification_tokens single-use tokens for verifying an email
--
-- Only the SHA-256 hash of a token is stored, so a database leak does
-- not hand out valid sessions.
--
-- This migration replaces the Alembic revision of the same name. The
-- SQL migrations under supabase/migrations/ are the single owner of the
-- schema; see backend/README.md.
-- =========================================================================

create table if not exists public.refresh_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  user_agent text,
  ip_address text,
  created_at timestamptz not null default now()
);

comment on table public.refresh_tokens is
  'The refresh tokens of the signed-in users. Only the SHA-256 hash is stored. '
  'A revoked row means the token was rotated out or explicitly revoked.';

create unique index if not exists refresh_tokens_token_hash_key
  on public.refresh_tokens (token_hash);
create index if not exists refresh_tokens_user_id_idx
  on public.refresh_tokens (user_id);
create index if not exists refresh_tokens_expires_at_idx
  on public.refresh_tokens (expires_at);

create table if not exists public.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.password_reset_tokens is
  'Single-use tokens for the password-reset flow. Setting a new password revokes every session of the user.';

create unique index if not exists password_reset_tokens_token_hash_key
  on public.password_reset_tokens (token_hash);
create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens (user_id);
create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens (expires_at);

create table if not exists public.email_verification_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.email_verification_tokens is
  'Single-use tokens for verifying an email address.';

create unique index if not exists email_verification_tokens_token_hash_key
  on public.email_verification_tokens (token_hash);
create index if not exists email_verification_tokens_user_id_idx
  on public.email_verification_tokens (user_id);
create index if not exists email_verification_tokens_expires_at_idx
  on public.email_verification_tokens (expires_at);

-- ---------------------------------------------------------------------------
-- RLS, with no policies
-- ---------------------------------------------------------------------------
-- These tables hold the session state, and `public` is exposed by
-- PostgREST. RLS is enabled with no policies, so an `anon` or
-- `authenticated` token cannot read or write them: only the backend,
-- which connects with the owner role and bypasses RLS, can.
alter table public.refresh_tokens enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.email_verification_tokens enable row level security;
