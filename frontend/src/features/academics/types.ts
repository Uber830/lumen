// =============================================================================
// Academics domain types.
// -----------------------------------------------------------------------------
// Entities (periods, courses, subjects, assignments, enrolments, members)
// and the input shapes for the academics hooks. Everything the academics
// module exposes is typed here; hooks and components import from this
// file rather than redefining shapes inline.
//
// Shared enums (SchoolRole, etc.) live in `@/lib/api/types`; this module
// re-exports the ones it uses so consumers have a single import.
// =============================================================================

import type { AcademicPeriodModality, EnrollmentStatus, SchoolRole } from "@/lib/api/types";

export type { AcademicPeriodModality, EnrollmentStatus, SchoolRole };

// --- Entities --------------------------------------------------------------

export type AcademicPeriod = {
  id: string;
  school_id: string;
  name: string;
  modality: AcademicPeriodModality;
  start_date: string;
  end_date: string;
  is_current: boolean;
  created_at: string;
  updated_at: string;
};

export type Course = {
  id: string;
  school_id: string;
  name: string;
  grade_label: string;
  created_at: string;
  updated_at: string;
};

export type CourseSummary = Course & {
  subject_count: number;
  enrolled_students: number;
  assigned_teachers: number;
};

export type Subject = {
  id: string;
  school_id: string;
  name: string;
  area: string | null;
  created_at: string;
  updated_at: string;
};

export type CourseSubject = {
  id: string;
  school_id: string;
  course_id: string;
  subject_id: string;
  created_at: string;
  updated_at: string;
};

export type CourseSubjectSummary = CourseSubject & {
  course_name: string;
  subject_name: string;
  subject_area: string | null;
  assigned_teachers: number;
};

export type TeacherAssignment = {
  id: string;
  school_id: string;
  course_subject_id: string;
  teacher_id: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
};

export type StudentEnrollment = {
  id: string;
  school_id: string;
  course_id: string;
  student_id: string;
  status: EnrollmentStatus;
  enrolled_at: string;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SchoolMember = {
  membership_id: string;
  school_id: string;
  user_id: string;
  role: SchoolRole;
  is_primary: boolean;
  joined_at: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  // The profile picture, when the member uploaded one.
  avatar_url: string | null;
  // When the membership was deactivated, or null when active.
  revoked_at: string | null;
  // True once the user has set a password (redeemed their activation).
  account_activated: boolean;
};

// --- Hook inputs -----------------------------------------------------------

export type CreateAcademicPeriodInput = {
  name: string;
  modality: AcademicPeriodModality;
  start_date: string;
  end_date: string;
  is_current?: boolean;
};

export type UpdateAcademicPeriodInput = {
  id: string;
  patch: Partial<AcademicPeriod>;
};

export type CreateCourseInput = {
  name: string;
  grade_label: string;
};

export type UpdateCourseInput = {
  id: string;
  patch: Partial<Course>;
};

export type CreateSubjectInput = {
  name: string;
  area?: string | null;
};

export type UpdateSubjectInput = {
  id: string;
  patch: Partial<Subject>;
};

export type CreateCourseSubjectInput = {
  course_id: string;
  subject_id: string;
};

export type CreateTeacherAssignmentInput = {
  course_subject_id: string;
  teacher_id: string;
};

export type UpdateTeacherAssignmentInput = {
  id: string;
  patch: Partial<CreateTeacherAssignmentInput>;
};

export type CreateStudentEnrollmentInput = {
  course_id: string;
  student_id: string;
  status?: StudentEnrollment["status"];
};
