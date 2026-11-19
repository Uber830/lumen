// =============================================================================
// "My subjects" — the materias a student is enrolled in.
// -----------------------------------------------------------------------------
// A student is enrolled in a course; a course offers several subjects
// (course_subjects). The academics endpoints return the school's rows,
// scoped by the backend to the school; the "which are mine" filter
// happens here, matching student_id against the signed-in user and
// keeping only active enrolments.
//
// This hook does that join once so the dashboard and any other student
// view share the same shape.
// =============================================================================

import { useMemo } from "react";

import { useCourseSubjects, useStudentEnrollments } from "@/features/academics/hooks";
import type { CourseSubjectSummary } from "@/features/academics/types";

/** One subject the student takes, with its course and display names. */
export type MySubject = CourseSubjectSummary;

export type MySubjectsResult = {
  items: MySubject[];
  /** The ids of the courses the student is actively enrolled in. */
  courseIds: string[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

/**
 * The subjects the signed-in student is enrolled in.
 *
 * Takes the student's active enrolments (by course) and expands them
 * into the course subjects offered in those courses, carrying the
 * course and subject names for display.
 */
export function useMySubjects(schoolId: string | null, studentId: string | null): MySubjectsResult {
  const enrollments = useStudentEnrollments(schoolId);
  const courseSubjects = useCourseSubjects(schoolId);

  const { items, courseIds } = useMemo(() => {
    if (!studentId || !enrollments.data || !courseSubjects.data) {
      return { items: [] as MySubject[], courseIds: [] as string[] };
    }

    // The courses this student is actively enrolled in.
    const myCourseIds = new Set<string>();
    for (const e of enrollments.data) {
      if (e.student_id === studentId && e.status === "active") {
        myCourseIds.add(e.course_id);
      }
    }

    const mine = courseSubjects.data
      .filter((cs) => myCourseIds.has(cs.course_id))
      .sort(
        (a, b) =>
          a.course_name.localeCompare(b.course_name, "es") ||
          a.subject_name.localeCompare(b.subject_name, "es"),
      );

    return { items: mine, courseIds: [...myCourseIds] };
  }, [studentId, enrollments.data, courseSubjects.data]);

  return {
    items,
    courseIds,
    isLoading: enrollments.isLoading || courseSubjects.isLoading,
    isError: enrollments.isError || courseSubjects.isError,
    error: (enrollments.error as Error | null) ?? (courseSubjects.error as Error | null),
  };
}
