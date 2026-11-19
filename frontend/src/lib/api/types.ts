// =============================================================================
// Cross-cutting API types: auth and shared enums.
// -----------------------------------------------------------------------------
// These mirror what the backend returns and are not owned by any single
// feature module: the auth session shapes (used across the app) and the
// enums several modules share.
//
// Entity types live with their module now — import them from there:
//   - academics  -> "@/features/academics/types"
//   - content/tasks/chat -> "@/lib/storage/types"
//   - grades     -> "@/lib/grades/types"
//   - icfes      -> "@/lib/icfes/types"
//   - billing    -> "@/lib/billing/types"
//   - school     -> "@/lib/school/types"
//   - users      -> "@/lib/users/types"
//
// When a response changes, the backend's OpenAPI document changes with
// it. `/openapi.json` is the reference.
// =============================================================================

// --- Shared enums ----------------------------------------------------------
// Used by more than one module, so they live here rather than in any
// single module's types.

import type { SchoolBranding } from "@/lib/school/types";

export type SchoolRole = "school_admin" | "teacher" | "student";
export type SchoolStatus = "active" | "trial" | "suspended";
export type AcademicPeriodModality = "bimestre" | "trimestre" | "semestre" | "anual";
export type EnrollmentStatus = "active" | "withdrawn" | "completed";
export type ContentKind = "document" | "video" | "link" | "text";
export type TaskSubmissionStatus = "draft" | "submitted" | "graded" | "returned";
export type EvaluationKind = "multiple_choice" | "true_false" | "open";
export type EvaluationAttemptStatus = "in_progress" | "submitted" | "graded" | "expired";

// --- Auth ------------------------------------------------------------------
// The session/token shapes the auth flow and the SSR session loader use
// across the whole app.

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_at: string;
  expires_in: number;
};

export type MembershipInfo = {
  id: string;
  school_id: string;
  role: SchoolRole;
  is_primary: boolean;
  joined_at: string;
};

export type ProfileInfo = {
  id: string;
  full_name: string;
  given_name: string | null;
  family_name: string | null;
  phone: string | null;
  locale: string;
  avatar_url: string | null;
};

export type SessionInfo = {
  user: { id: string; email: string | null };
  profile: ProfileInfo | null;
  memberships: MembershipInfo[];
  platform_role: "platform_admin" | null;
  primary_school_id: string | null;
  // The branding of the primary school. It travels with the session so
  // the app paints itself with the school's colour and logo on the
  // first frame.
  school: SchoolBranding | null;
};

export type AuthResponse = {
  tokens: TokenPair;
  session: SessionInfo;
  // A short-lived token for Supabase Storage and Realtime. It is not
  // an authentication token.
  supabase_token: string | null;
};

// --- Evaluations -----------------------------------------------------------
// Not yet consumed by any hook/view. Kept here as the backend contract
// reference; move to an `evaluations` module when its hooks are built,
// following the per-module types pattern.

export type Evaluation = {
  id: string;
  school_id: string;
  course_subject_id: string;
  posted_by: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  due_at: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

export type EvaluationQuestion = {
  id: string;
  school_id: string;
  evaluation_id: string;
  position: number;
  kind: EvaluationKind;
  prompt: string;
  options: string[] | null;
  points: string;
  created_at: string;
  updated_at: string;
};

export type EvaluationAnswerKey = {
  id: string;
  school_id: string;
  evaluation_id: string;
  question_id: string;
  closed_answer: number | null;
  closed_boolean: boolean | null;
  model_answer: string | null;
  points: string;
  created_at: string;
  updated_at: string;
};

export type EvaluationAttempt = {
  id: string;
  school_id: string;
  evaluation_id: string;
  student_id: string;
  status: EvaluationAttemptStatus;
  started_at: string;
  submitted_at: string | null;
  graded_at: string | null;
  score: string | null;
  max_score: string | null;
  created_at: string;
  updated_at: string;
};

export type EvaluationAnswer = {
  id: string;
  school_id: string;
  attempt_id: string;
  question_id: string;
  closed_answer: number | null;
  closed_boolean: boolean | null;
  text_answer: string | null;
  points_awarded: string | null;
  graded_by: string | null;
  graded_at: string | null;
  feedback: string | null;
  created_at: string;
  updated_at: string;
};

// --- ICFES -----------------------------------------------------------------

export type IcfesQuestion = {
  id: string;
  school_id: string;
  area: string;
  grado: string;
  difficulty: string;
  competencia: string | null;
  prompt: string;
  reading: string | null;
  options: string[];
  points: string;
  created_at: string;
  updated_at: string;
};

export type IcfesAnswerKey = {
  id: string;
  school_id: string;
  question_id: string;
  correct_index: number;
  created_at: string;
  updated_at: string;
};

export type IcfesSimulation = {
  id: string;
  school_id: string;
  course_subject_id: string;
  posted_by: string;
  title: string;
  description: string | null;
  duration_minutes: number | null;
  available_from: string | null;
  available_until: string | null;
  is_published: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  created_at: string;
  updated_at: string;
  question_count: number;
};

export type IcfesComparison = {
  simulation_id: string;
  title: string;
  course_subject_id: string;
  available_from: string | null;
  available_until: string | null;
  student_count: number;
  avg_global: number;
  avg_max: number;
  avg_percent: number;
  by_area: Array<{ area: string; correct: number; total: number; percent: number }>;
};

/** A question of an ICFES attempt, as the student receives it. */
export type IcfesAttemptQuestion = {
  id: string;
  area: string;
  prompt: string;
  reading: string | null;
  options: string[];
  points: number;
};

/** The payload the backend returns when an ICFES attempt starts. */
export type IcfesAttemptStart = {
  attempt_id: string;
  simulation_id: string;
  questions: IcfesAttemptQuestion[];
};

/** The score of one area of an ICFES attempt. */
export type IcfesAreaScore = {
  area: string;
  correct: number;
  total: number;
  percent: number;
};

/** The score of an ICFES attempt, calculated by the backend. */
export type IcfesAttemptScore = {
  attempt_id: string;
  global_score: number;
  max_score: number;
  percent: number;
  puntaje_global: number;
  by_area: IcfesAreaScore[];
  correct_count: number;
  question_count: number;
};

// --- Chat ------------------------------------------------------------------

export type ChatConversation = {
  id: string;
  school_id: string;
  created_by: string;
  title: string | null;
  kind: "direct" | "group";
  created_at: string;
  updated_at: string;
};

export type ChatMember = {
  id: string;
  school_id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_at: string;
  created_at: string;
  updated_at: string;
  full_name: string | null;
  email: string | null;
};

export type ChatMessage = {
  id: string;
  school_id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  sent_at: string;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
  sender_name: string | null;
};

// --- Notifications ---------------------------------------------------------

export type NotificationKind =
  "task_assigned" | "task_submitted" | "task_graded" | "content_published" | "chat_message";

export type Notification = {
  id: string;
  school_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UnreadCount = {
  unread: number;
};

export type NotificationPreference = {
  kind: NotificationKind;
  in_app: boolean;
  email: boolean;
};

export type NotificationPreferences = {
  preferences: NotificationPreference[];
};

// --- Billing ---------------------------------------------------------------

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  interval: string;
  max_students: number | null;
  max_teachers: number | null;
  max_storage_gb: number | null;
  includes_icfes: boolean;
};

export type Subscription = {
  id: string;
  school_id: string;
  plan_id: string;
  status: string;
  interval: string;
  customer_email: string | null;
  wompi_subscription_id: string | null;
  wompi_payment_source_id: string | null;
  started_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  raw: unknown;
  created_at: string;
  updated_at: string;
};

export type Entitlement = {
  school_id: string;
  plan_code: string;
  plan_name: string;
  max_students: number | null;
  max_teachers: number | null;
  max_storage_gb: number | null;
  includes_icfes: boolean;
  subscription_id: string | null;
  status: string;
  current_period_end: string | null;
  updated_at: string;
};

// --- Dashboard -------------------------------------------------------------

export type SchoolStats = {
  schoolId: string;
  schoolName: string;
  schoolShortCode: string;
  schoolStatus: "active" | "trial" | "suspended";
  currentPeriod: { id: string; name: string; modality: string } | null;
  students: number;
  teachers: number;
  courses: number;
  pendingTasks: number;
};

// --- Student helpers --------------------------------------------------------

/** A teacher of one of the student's own courses. */
export type StudentTeacher = {
  user_id: string;
  full_name: string;
  email: string | null;
  subjects: string[];
};
