-- =========================================================================
-- Profile avatars: the public URL of the per-user photo.
-- -------------------------------------------------------------------------
-- The URL is stored on public.profiles.avatar_url and rendered by anyone
-- who can see the profile (the existing profiles RLS already gates that).
-- The file itself is served by the backend, so this migration only owns
-- the column.
-- =========================================================================

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL of the user avatar, or null if unset.';

-- ---------------------------------------------------------------------------
-- The profiles.avatar_url column is covered by the existing
-- profiles_update_self policy (auth.uid() = id), so we do not need a
-- separate policy. The TanStack Start server function updateProfile
-- runs on behalf of the authenticated user, so the RLS check is
-- satisfied automatically.
-- ---------------------------------------------------------------------------
