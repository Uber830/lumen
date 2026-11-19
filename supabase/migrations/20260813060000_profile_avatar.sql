-- =========================================================================
-- Profile avatars: per-user photo stored in Supabase Storage.
-- -------------------------------------------------------------------------
-- Path convention: avatars/{auth.uid()}/avatar.{png|jpg|webp}
--
-- Read is public (the same pattern as school-logos): the avatar URL is
-- stored on public.profiles.avatar_url and rendered by anyone who can
-- see the profile (the existing profiles RLS already gates that).
--
-- Write/update/delete are restricted to the user's own folder via
-- string_to_array(name, '/')[1]::uuid = auth.uid(). This matches the
-- path pattern used by the other buckets in this project
-- (class-content, school-logos, task-submissions).
--
-- Note on storage.foldername: it returns text[] (an array of the
-- path segments, split on '/'), NOT text. So a bare
-- (storage.foldername(name)) = (select auth.uid())::text raises
-- 42883 ("operator does not exist: text[] = text"). Using
-- string_to_array(name, '/')[1]::uuid instead matches the rest of
-- the codebase and works on a single index lookup.
-- =========================================================================

alter table public.profiles
  add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL of the user avatar in the storage.avatars bucket, or null if unset. Path inside the bucket is avatars/{auth.uid()}/avatar.{ext}.';

-- Bucket ------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']::text[]
)
on conflict (id) do nothing;

-- RLS ---------------------------------------------------------------------
-- The 'avatars' bucket is public for reads; the URL is meaningless
-- without a corresponding profile row, which has its own RLS.
drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars: owner write" on storage.objects;
create policy "avatars: owner write"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (string_to_array(name, '/'))[1]::uuid = (select auth.uid())
  );

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (string_to_array(name, '/'))[1]::uuid = (select auth.uid())
  )
  with check (
    bucket_id = 'avatars'
    and (string_to_array(name, '/'))[1]::uuid = (select auth.uid())
  );

drop policy if exists "avatars: owner delete" on storage.objects;
create policy "avatars: owner delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (string_to_array(name, '/'))[1]::uuid = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- The profiles.avatar_url column is covered by the existing
-- profiles_update_self policy (auth.uid() = id), so we do not need a
-- separate policy. The TanStack Start server function updateProfile
-- runs on behalf of the authenticated user, so the RLS check is
-- satisfied automatically.
-- ---------------------------------------------------------------------------
