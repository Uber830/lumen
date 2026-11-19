// =============================================================================
// The roster of a course: the students enrolled in it, with names.
// -----------------------------------------------------------------------------
// There is no "students of a course subject" endpoint: a course
// subject belongs to a course, and students enrol in the course. So
// the roster is the active enrolments of the course, resolved to names
// through the member list. Both the subject's "Estudiantes" tab and
// its grade grid read this.
// =============================================================================

import { useMemo } from "react";

import { useSchoolMembers, useStudentEnrollments } from "@/features/academics/hooks";
import type { SchoolMember } from "@/features/academics/types";
import type { CourseRosterResult, RosterStudent } from "@/features/teacher/types";

export type { CourseRosterResult, RosterStudent };

/**
 * The active students enrolled in a course, with display names.
 *
 * Pass the course id (not the course subject id). Returns a stable,
 * name-sorted list.
 */
export function useCourseRoster(
  schoolId: string | null,
  courseId: string | null,
): CourseRosterResult {
  const enrollments = useStudentEnrollments(schoolId);
  const members = useSchoolMembers(schoolId, "student");

  const students = useMemo<RosterStudent[]>(() => {
    if (!courseId || !enrollments.data || !members.data) return [];
    const byId = new Map<string, SchoolMember>(members.data.map((m) => [m.user_id, m]));

    return enrollments.data
      .filter((e) => e.course_id === courseId && e.status === "active")
      .map((e) => {
        const member = byId.get(e.student_id);
        return {
          studentId: e.student_id,
          name: member?.full_name ?? "(sin nombre)",
          email: member?.email ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [courseId, enrollments.data, members.data]);

  return {
    students,
    isLoading: enrollments.isLoading || members.isLoading,
    isError: enrollments.isError || members.isError,
    error: (enrollments.error as Error | null) ?? (members.error as Error | null),
  };
}
