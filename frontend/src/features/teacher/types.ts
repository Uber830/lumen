// =============================================================================
// Teacher-feature view types.
// -----------------------------------------------------------------------------
// Derived/combined shapes used by the teacher hooks (not raw API
// entities): the teacher's own course subjects and a course roster.
// =============================================================================

import type { CourseSubjectSummary } from "@/features/academics/types";

/** One course subject the teacher is assigned to, with display names. */
export type MyCourseSubject = CourseSubjectSummary & {
  /** The id of the teacher_assignment that links me to this course subject. */
  assignment_id: string;
  /** Students enrolled in this course subject's course (from CourseSummary). */
  enrolled_students: number;
};

export type MyCourseSubjectsResult = {
  items: MyCourseSubject[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};

export type RosterStudent = {
  studentId: string;
  name: string;
  email: string | null;
};

export type CourseRosterResult = {
  students: RosterStudent[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
};
