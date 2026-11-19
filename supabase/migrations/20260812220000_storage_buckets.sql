-- =========================================================================
-- Storage buckets and policies for Phase 4.
-- -------------------------------------------------------------------------
-- school-logos:   public read; only school_admin can write. Used by
--                 admin/personalizacion.tsx.
-- class-content:  private; only members of the school and the assigned
--                 teacher can read; only the assigned teacher can write.
--                 Path: {school_id}/{course_subject_id}/{uuid}.{ext}
-- task-submissions: private; only the student (owner) and the assigned
--                 teacher can read; only the student can write.
--                 Path: {school_id}/{task_id}/{student_id}/{uuid}.{ext}
-- =========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'school-logos',
    'school-logos',
    true,
    5 * 1024 * 1024,
    array['image/png', 'image/jpeg', 'image/svg+xml']
  ),
  (
    'class-content',
    'class-content',
    false,
    50 * 1024 * 1024,
    null
  ),
  (
    'task-submissions',
    'task-submissions',
    false,
    50 * 1024 * 1024,
    null
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- school-logos
-- Public read; only school_admin can write.
-- ---------------------------------------------------------------------------
drop policy if exists "school-logos: public read" on storage.objects;
create policy "school-logos: public read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'school-logos');

drop policy if exists "school-logos: admin write" on storage.objects;
create policy "school-logos: admin write"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'school-logos'
    and (select public.has_school_role(
        (string_to_array(name, '/'))[1]::uuid,
        'school_admin'
      ))
  );

drop policy if exists "school-logos: admin update" on storage.objects;
create policy "school-logos: admin update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'school-logos'
    and (select public.has_school_role(
        (string_to_array(name, '/'))[1]::uuid,
        'school_admin'
      ))
  )
  with check (
    bucket_id = 'school-logos'
    and (select public.has_school_role(
        (string_to_array(name, '/'))[1]::uuid,
        'school_admin'
      ))
  );

drop policy if exists "school-logos: admin delete" on storage.objects;
create policy "school-logos: admin delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'school-logos'
    and (select public.has_school_role(
        (string_to_array(name, '/'))[1]::uuid,
        'school_admin'
      ))
  );

-- ---------------------------------------------------------------------------
-- class-content
-- Path: {school_id}/{course_subject_id}/{uuid}.{ext}
-- READ: any school member
-- WRITE: only the teacher of the course_subject
-- ---------------------------------------------------------------------------
drop policy if exists "class-content: school member read" on storage.objects;
create policy "class-content: school member read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'class-content'
    and (select public.is_school_member((string_to_array(name, '/'))[1]::uuid))
  );

drop policy if exists "class-content: teacher write" on storage.objects;
create policy "class-content: teacher write"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'class-content'
    and (select public.is_course_subject_teacher(
        (string_to_array(name, '/'))[1]::uuid,
        (string_to_array(name, '/'))[2]::uuid
      ))
  );

drop policy if exists "class-content: teacher update" on storage.objects;
create policy "class-content: teacher update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'class-content'
    and (select public.is_course_subject_teacher(
        (string_to_array(name, '/'))[1]::uuid,
        (string_to_array(name, '/'))[2]::uuid
      ))
  )
  with check (
    bucket_id = 'class-content'
    and (select public.is_course_subject_teacher(
        (string_to_array(name, '/'))[1]::uuid,
        (string_to_array(name, '/'))[2]::uuid
      ))
  );

drop policy if exists "class-content: teacher delete" on storage.objects;
create policy "class-content: teacher delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'class-content'
    and (select public.is_course_subject_teacher(
        (string_to_array(name, '/'))[1]::uuid,
        (string_to_array(name, '/'))[2]::uuid
      ))
  );

-- ---------------------------------------------------------------------------
-- task-submissions
-- Path: {school_id}/{task_id}/{student_id}/{uuid}.{ext}
-- READ: the student (owner of the path) and the assigned teacher of the task
-- WRITE: only the student owner
-- ---------------------------------------------------------------------------
drop policy if exists "task-submissions: owner or teacher read" on storage.objects;
create policy "task-submissions: owner or teacher read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'task-submissions'
    and (
      (string_to_array(name, '/'))[3]::uuid = (select auth.uid())
      or (select public.is_course_subject_teacher(
            (string_to_array(name, '/'))[1]::uuid,
            (select course_subject_id from public.tasks where id = (string_to_array(name, '/'))[2]::uuid)
          ))
    )
  );

drop policy if exists "task-submissions: student write" on storage.objects;
create policy "task-submissions: student write"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'task-submissions'
    and (string_to_array(name, '/'))[3]::uuid = (select auth.uid())
  );

drop policy if exists "task-submissions: student update" on storage.objects;
create policy "task-submissions: student update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'task-submissions'
    and (string_to_array(name, '/'))[3]::uuid = (select auth.uid())
  )
  with check (
    bucket_id = 'task-submissions'
    and (string_to_array(name, '/'))[3]::uuid = (select auth.uid())
  );

drop policy if exists "task-submissions: student delete" on storage.objects;
create policy "task-submissions: student delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'task-submissions'
    and (string_to_array(name, '/'))[3]::uuid = (select auth.uid())
  );
