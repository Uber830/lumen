-- =========================================================================
-- content_items and content_progress.
-- -------------------------------------------------------------------------
-- content_items is material a teacher posts to a course_subject (a
-- document, a video URL, a link, or a text note). content_progress
-- tracks when each student has finished reading/watching it.
-- =========================================================================

create type content_kind as enum ('document', 'video', 'link', 'text');

create table public.content_items (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  course_subject_id  uuid not null references public.course_subjects(id) on delete cascade,
  posted_by          uuid not null references auth.users(id) on delete restrict,
  title              text not null,
  description        text,
  kind               content_kind not null,
  -- For document/video the bucket path is "{school_id}/{course_subject_id}/{uuid}".
  -- For link, this is the external URL. For text, no url is required.
  storage_path       text,
  external_url       text,
  body               text,
  posted_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint content_items_kind_check check (
    (kind = 'document' and storage_path is not null) or
    (kind = 'video' and (storage_path is not null or external_url is not null)) or
    (kind = 'link' and external_url is not null) or
    (kind = 'text' and body is not null)
  )
);

create index content_items_school_id_idx on public.content_items (school_id);
create index content_items_course_subject_id_idx on public.content_items (course_subject_id);
create index content_items_posted_by_idx on public.content_items (posted_by);

comment on table public.content_items is
  'Material posted by a teacher to a course_subject. body is non-null for kind=text; storage_path or external_url is non-null for the other kinds.';

create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();

create table public.content_progress (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  content_item_id  uuid not null references public.content_items(id) on delete cascade,
  student_id       uuid not null references auth.users(id) on delete cascade,
  completed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  constraint content_progress_item_student_uq unique (content_item_id, student_id)
);

create index content_progress_school_id_idx on public.content_progress (school_id);
create index content_progress_student_id_idx on public.content_progress (student_id);

comment on table public.content_progress is
  'Tracks when a student has finished a content_item. Unique per (content_item, student).';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.content_items enable row level security;
alter table public.content_progress enable row level security;

-- content_items
drop policy if exists content_items_select on public.content_items;
create policy content_items_select
  on public.content_items
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or (select public.is_course_student(school_id, (select course_id from public.course_subjects where id = course_subject_id)))
  );

drop policy if exists content_items_teacher_write on public.content_items;
create policy content_items_teacher_write
  on public.content_items
  for insert
  to authenticated
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists content_items_teacher_update on public.content_items;
create policy content_items_teacher_update
  on public.content_items
  for update
  to authenticated
  using (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
    or posted_by = (select auth.uid())
  )
  with check (
    is_platform_admin()
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

drop policy if exists content_items_teacher_delete on public.content_items;
create policy content_items_teacher_delete
  on public.content_items
  for delete
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, course_subject_id))
  );

-- content_progress
drop policy if exists content_progress_select on public.content_progress;
create policy content_progress_select
  on public.content_progress
  for select
  to authenticated
  using (
    is_platform_admin()
    or (select public.has_school_role(school_id, 'school_admin'))
    or (select public.is_course_subject_teacher(school_id, (select course_subject_id from public.content_items where id = content_item_id)))
    or student_id = (select auth.uid())
  );

drop policy if exists content_progress_student_write on public.content_progress;
create policy content_progress_student_write
  on public.content_progress
  for insert
  to authenticated
  with check (
    student_id = (select auth.uid())
  );

drop policy if exists content_progress_student_update on public.content_progress;
create policy content_progress_student_update
  on public.content_progress
  for update
  to authenticated
  using (student_id = (select auth.uid()))
  with check (student_id = (select auth.uid()));

drop policy if exists content_progress_owner_delete on public.content_progress;
create policy content_progress_owner_delete
  on public.content_progress
  for delete
  to authenticated
  using (student_id = (select auth.uid()));
