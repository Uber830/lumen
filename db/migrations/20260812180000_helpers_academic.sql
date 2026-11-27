-- =========================================================================
-- SECURITY DEFINER helpers for academic-level checks.
-- -------------------------------------------------------------------------
-- These helpers answer questions that future RLS policies on content,
-- tasks, evaluations, and chat will need. They are added in Phase 2
-- so that they are documented and testable before that work starts.
--
-- is_course_subject_teacher(school_id, course_subject_id):
--   current user is a teacher assigned to this course_subject
-- is_course_student(school_id, course_id):
--   current user has an active enrollment in this course
-- =========================================================================

create or replace function public.is_course_subject_teacher(
  school_id uuid,
  course_subject_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.teacher_assignments ta
    where ta.school_id = $1
      and ta.course_subject_id = $2
      and ta.teacher_id = (select auth.uid())
  );
$$;

comment on function public.is_course_subject_teacher(uuid, uuid) is
  'True if the current authenticated user is a teacher assigned to this course_subject. Used by Phase 4 RLS policies.';

create or replace function public.is_course_student(
  school_id uuid,
  course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.student_enrollments se
    where se.school_id = $1
      and se.course_id = $2
      and se.student_id = (select auth.uid())
      and se.status = 'active'
  );
$$;

comment on function public.is_course_student(uuid, uuid) is
  'True if the current authenticated user has an active enrollment in this course. Used by Phase 4 RLS policies.';

revoke execute on function public.is_course_subject_teacher(uuid, uuid) from public;
grant execute on function public.is_course_subject_teacher(uuid, uuid) to authenticated;

revoke execute on function public.is_course_student(uuid, uuid) from public;
grant execute on function public.is_course_student(uuid, uuid) to authenticated;
