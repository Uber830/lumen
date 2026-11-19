// =========================================================================
// Centralized types for the admin domain.
// -------------------------------------------------------------------------
// Every type the admin dashboard and the CRUD pages consume or emit
// lives here. Routes import from this file instead of re-declaring
// interfaces inline, which was the source of duplicated shapes and
// the `as TipoPersonalizado[]` casts in features/academics/hooks.ts.
//
// Layering:
//   1. API rows:      the shapes the backend returns
//   2. Domain views:  row + joined relations, ready for the UI
//   3. Form values:   input shapes for the create/update forms
//   4. Dashboard:     aggregate values the home page renders
//
// The entity row types now come from their feature modules
// (@/features/academics/types, @/lib/storage/types); the shared enums
// come from @/lib/api/types. When a response changes, the backend's
// OpenAPI document changes with it.
// =========================================================================

import type {
  AcademicPeriod,
  Course,
  CourseSubject,
  SchoolMember,
  StudentEnrollment,
  Subject,
  TeacherAssignment,
} from "@/features/academics/types";
import type {
  ChatConversation,
  ChatMessage,
  ContentItem,
  Task,
  TaskSubmission,
} from "@/lib/storage/types";
import type { EnrollmentStatus, SchoolRole, SchoolStatus } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// 1. API row re-exports — single point of reference for what the schema
//    actually contains. Avoid `Tables["x"]["Row"]` strings scattered
//    across the app.
// ---------------------------------------------------------------------------

export type {
  AcademicPeriod,
  Course,
  CourseSubject,
  StudentEnrollment,
  Subject,
  TeacherAssignment,
};
export type { ChatConversation, ChatMessage, ContentItem, Task, TaskSubmission };
export type { EnrollmentStatus, SchoolRole };

export type Profile = {
  id: string;
  full_name: string;
  given_name: string | null;
  family_name: string | null;
  phone: string | null;
  locale: string;
  avatar_url: string | null;
};

export type School = {
  id: string;
  name: string;
  short_code: string;
  status: SchoolStatus;
};

export type SchoolMembership = {
  id: string;
  school_id: string;
  user_id: string;
  role: SchoolRole;
  is_primary: boolean;
  joined_at: string;
  revoked_at: string | null;
};

// ---------------------------------------------------------------------------
// 2. Domain views — what the UI actually displays, after joining the
//    tables that RLS allows a school_admin to read.
// ---------------------------------------------------------------------------

/**
 * A member of a school (any role) joined with their profile so the UI
 * doesn't have to do a second query for the display name.
 *
 * It lives in the academics module, next to the rest of the school
 * entities: this file only re-exports it so the admin views have a
 * single import path.
 */
export type { SchoolMember } from "@/features/academics/types";

/**
 * Teacher view with the count of subjects they teach. Used by the teachers list and
 * the "unassigned" alert on the dashboard.
 */
export type TeacherSummary = SchoolMember & {
  assigned_course_subjects: number;
};

/**
 * Student view with enrollment count and current average. The average
 * is null until grades are populated.
 */
export type StudentSummary = SchoolMember & {
  enrolled_courses: number;
  current_average: number | null;
};

/**
 * Course view with the count of subjects, students enrolled, and
 * the assigned teachers. Used by the courses list and the dashboard.
 */
export type CourseSummary = Course & {
  subject_count: number;
  enrolled_students: number;
  assigned_teachers: number;
};

/**
 * CourseSubject view with the human-readable course and subject names
 * so the UI doesn't have to join twice to render a row.
 */
export type CourseSubjectSummary = CourseSubject & {
  course_name: string;
  subject_name: string;
  subject_area: string | null;
  assigned_teachers: number;
};

/**
 * Period view with a count of courses open in that period. Used by the
 * periods list and the dashboard's "current period" header.
 */
export type AcademicPeriodSummary = AcademicPeriod & {
  course_count: number;
};

/**
 * Task view with the count of pending submissions. Used by the
 * dashboard's "Tareas sin revisar" stat card and the tasks list.
 */
export type TaskSummary = Task & {
  course_subject_label: string;
  pending_submissions: number;
  total_submissions: number;
};

// ---------------------------------------------------------------------------
// 3. Form values — re-export the zod inferred types so routes import
//    from this central barrel. Schemas stay in lib/schemas/ because
//    they carry the runtime validation logic; here we just expose
//    their static shape.
// ---------------------------------------------------------------------------

export type { AcademicPeriodFormValues } from "@/lib/schemas/academic-period";
export type { CourseFormValues } from "@/lib/schemas/course";
export type { SubjectFormValues } from "@/lib/schemas/subject";
export type { CourseSubjectFormValues } from "@/lib/schemas/course-subject";
export type { TeacherAssignmentFormValues } from "@/lib/schemas/teacher-assignment";
export type { StudentEnrollmentFormValues } from "@/lib/schemas/student-enrollment";
export type { ContentItemFormValues } from "@/lib/schemas/content";
export type { TaskFormValues, TaskSubmissionFormValues } from "@/lib/schemas/task";
export type { ChatMessageFormValues, ChatConversationFormValues } from "@/lib/schemas/chat";

// Enum value types are derived from the API types directly, so they
// stay in sync with the backend without a parallel zod enum.
export type { AcademicPeriodModality, ContentKind, TaskSubmissionStatus } from "@/lib/api/types";

// ---------------------------------------------------------------------------
// 4. Dashboard aggregates — what the admin home page renders. The hook
//    useSchoolStats() resolves each field by counting rows in the
//    appropriate table; the trends stay derived until the backend
//    exposes a real series.
// ---------------------------------------------------------------------------

export type SchoolStats = {
  schoolId: string;
  schoolName: string;
  schoolShortCode: string;
  schoolStatus: "active" | "trial" | "suspended";
  currentPeriod: Pick<AcademicPeriod, "id" | "name" | "modality"> | null;
  students: number;
  teachers: number;
  courses: number;
  pendingTasks: number;
};

export type SchoolStatsTrend = {
  month: string;
  students: number;
  teachers: number;
};

export type SchoolStatsAttendance = {
  grade: string;
  attendancePct: number;
};
