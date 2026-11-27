-- =========================================================================
-- create the users table, and repoint the identity foreign keys to it.
-- -------------------------------------------------------------------------
-- The authentication of the platform is being replaced by the backend's
-- own. `auth.users` was the identity table; `public.users` takes its
-- place.
--
-- The rows are copied over from `auth.users`, preserving the UUIDs, so
-- the foreign keys that point at a user keep referring to the same
-- identity.
--
-- The passwords are copied too, as they are. The previous identity
-- provider stored bcrypt
-- (`$2a$...`) and this backend verifies Argon2id, so `verify_password`
-- accepts bcrypt for exactly this migration; the first successful
-- login rehashes the password to Argon2id. Accounts that never log in
-- keep the bcrypt hash, which is why the check for it stays.
--
-- This migration replaces the Alembic revision of the same name. The
-- SQL migrations under db/migrations/ are the single owner of the
-- schema; see backend/README.md.
-- =========================================================================

create table if not exists public.users (
  id             uuid primary key default gen_random_uuid(),
  email          text not null,
  password_hash  text not null,
  full_name      text,
  email_verified boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists users_email_key on public.users (email);

create index if not exists users_email_lower_idx on public.users (lower(email));

-- Recreated, not just created: applying the migration twice must not
-- fail on a trigger that is already there.
drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- RLS with no policies: the table is reachable only through the API.
-- `public` is exposed by PostgREST, and this table holds the
-- password hashes, so nobody holding an `anon` or `authenticated`
-- token may read it. The backend connects with the owner role, which
-- bypasses RLS.
alter table public.users enable row level security;

comment on table public.users is
  'The identity table. Replaces auth.users since the backend owns authentication. '
  'password_hash holds an Argon2id hash; an empty hash means the account has not set a password yet. '
  'RLS is enabled with no policies: the API is the only way in.';

-- ---------------------------------------------------------------------------
-- Copy the identities over, keeping the UUIDs.
-- ---------------------------------------------------------------------------
do $$
begin
  -- The table only exists in a database that inherited the old
  -- identity. In a plain Postgres (CI, local development) there is
  -- nothing to copy and the identity table starts empty.
  if to_regclass('auth.users') is not null then
    execute $copy$
      insert into public.users (id, email, password_hash, full_name,
                                email_verified, created_at, updated_at)
      select u.id,
             u.email,
             -- The bcrypt hash, verbatim. `verify_password` accepts
             -- it and the next successful login upgrades it to
             -- Argon2id.
             coalesce(u.encrypted_password, ''),
             u.raw_user_meta_data ->> 'full_name',
             (u.email_confirmed_at is not null),
             coalesce(u.created_at, now()),
             coalesce(u.updated_at, now())
      from auth.users u
      on conflict (id) do nothing
    $copy$;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Repoint the foreign keys that referenced auth.users(id).
-- ---------------------------------------------------------------------------
do $$
declare
  fk record;
begin
  -- Every column that referenced auth.users(id), with the delete rule
  -- it had.
  for fk in
    select * from (values
      ('profiles',                        'id',              'cascade'),
      ('platform_roles',                  'user_id',         'cascade'),
      ('platform_roles',                  'granted_by',      'set null'),
      ('school_memberships',              'user_id',         'cascade'),
      ('teacher_assignments',             'teacher_id',      'cascade'),
      ('student_enrollments',             'student_id',      'cascade'),
      ('content_items',                   'posted_by',       'restrict'),
      ('content_progress',                'student_id',      'cascade'),
      ('tasks',                           'posted_by',       'restrict'),
      ('task_submissions',                'student_id',      'cascade'),
      ('task_submissions',                'graded_by',       'set null'),
      ('grades',                          'student_id',      'cascade'),
      ('grades',                          'recorded_by',     'set null'),
      ('chat_conversations',              'created_by',      'restrict'),
      ('chat_members',                    'user_id',         'cascade'),
      ('chat_messages',                   'sender_id',       'restrict'),
      ('evaluations',                     'posted_by',       'restrict'),
      ('evaluation_attempts',             'student_id',      'cascade'),
      ('evaluation_answers',              'graded_by',       'set null'),
      ('icfes_simulations',               'posted_by',       'restrict'),
      ('icfes_attempts',                  'student_id',      'cascade')
    ) as t(table_name, column_name, delete_rule)
  loop
    -- Drop whatever the constraint is called: Postgres named it after
    -- the column, but a project may have renamed it.
    execute format(
      'alter table public.%I drop constraint if exists %I',
      fk.table_name, fk.table_name || '_' || fk.column_name || '_fkey'
    );
    execute format(
      'alter table public.%I drop constraint if exists %I',
      fk.table_name, fk.table_name || '_' || fk.column_name || '_key'
    );

    -- Add it back, pointing at public.users. The delete rule is a
    -- literal from the list above, not an identifier, so it is
    -- interpolated as text.
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) '
      'references public.users(id) on delete %s',
      fk.table_name,
      fk.table_name || '_' || fk.column_name || '_fkey',
      fk.column_name,
      fk.delete_rule
    );
  end loop;
end
$$;
