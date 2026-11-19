// =============================================================================
// "My course subjects" — the materias a teacher actually teaches.
// -----------------------------------------------------------------------------
// The academics endpoints return every assignment and course subject
// of the school, not just the caller's: the backend scopes to the
// school, and the "which ones are mine" filter happens in the client
// by matching teacher_id against the signed-in user.
//
// This hook does that join once so the dashboard, the subject view and
// the grade sheet all share the same shape instead of each re-deriving
// it. Reads are cheap and cached by React Query.
// =============================================================================

import { useMemo } from "react";

import { useCourses, useCourseSubjects, useTeacherAssignments } from "@/features/academics/hooks";
import type { CourseSubjectSummary } from "@/features/academics/types";
import type { MyCourseSubject, MyCourseSubjectsResult } from "@/features/teacher/types";

export type { MyCourseSubject, MyCourseSubjectsResult };

/**
 * The course subjects the signed-in teacher teaches.
 *
 * Combines the teacher's assignments (filtered to their user id) with
 * the school's course-subject summaries (which carry course_name,
 * subject_name and enrolment counts). Returns a stable, memoised list.
 */
export function useMyCourseSubjects(
  schoolId: string | null,
  teacherId: string | null,
): MyCourseSubjectsResult {
  const assignments = useTeacherAssignments(schoolId);
  const courseSubjects = useCourseSubjects(schoolId);
  const courses = useCourses(schoolId);

  const items = useMemo<MyCourseSubject[]>(() => {
    if (!teacherId || !assignments.data || !courseSubjects.data) return [];

    // The course subject rows, indexed for a single-pass join.
    const byId = new Map<string, CourseSubjectSummary>(
      courseSubjects.data.map((cs) => [cs.id, cs]),
    );
    // Enrolment counts live on the course summary, keyed by course id.
    const studentsByCourse = new Map<string, number>(
      (courses.data ?? []).map((c) => [c.id, c.enrolled_students]),
    );

    const mine: MyCourseSubject[] = [];
    for (const assignment of assignments.data) {
      if (assignment.teacher_id !== teacherId) continue;
      const cs = byId.get(assignment.course_subject_id);
      if (!cs) continue; // Assignment to a course subject the school no longer offers.
      mine.push({
        ...cs,
        assignment_id: assignment.id,
        enrolled_students: studentsByCourse.get(cs.course_id) ?? 0,
      });
    }

    // Stable order: by course, then subject, so the UI does not jump.
    mine.sort(
      (a, b) =>
        a.course_name.localeCompare(b.course_name, "es") ||
        a.subject_name.localeCompare(b.subject_name, "es"),
    );
    return mine;
  }, [teacherId, assignments.data, courseSubjects.data, courses.data]);

  return {
    items,
    isLoading: assignments.isLoading || courseSubjects.isLoading || courses.isLoading,
    isError: assignments.isError || courseSubjects.isError || courses.isError,
    error:
      (assignments.error as Error | null) ??
      (courseSubjects.error as Error | null) ??
      (courses.error as Error | null),
  };
}
