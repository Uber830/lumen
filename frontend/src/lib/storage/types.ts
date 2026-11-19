// =============================================================================
// Storage-module domain types: content, tasks and chat.
// -----------------------------------------------------------------------------
// The entities these hooks read/write, plus the input shapes for the
// mutations. The storage hooks (content items, tasks, submissions and
// chat) import everything from here.
//
// Shared enums (ContentKind, TaskSubmissionStatus) live in
// `@/lib/api/types`; re-exported here so consumers have one import.
// =============================================================================

import type { ContentKind, TaskSubmissionStatus } from "@/lib/api/types";

export type { ContentKind, TaskSubmissionStatus };

// --- Content ---------------------------------------------------------------

export type ContentItem = {
  id: string;
  school_id: string;
  course_subject_id: string;
  posted_by: string;
  title: string;
  description: string | null;
  kind: ContentKind;
  storage_path: string | null;
  external_url: string | null;
  body: string | null;
  posted_at: string;
  created_at: string;
  updated_at: string;
};

export type ContentProgress = {
  id: string;
  school_id: string;
  content_item_id: string;
  student_id: string;
  completed_at: string;
  created_at: string;
};

export type CreateContentItemInput = {
  title: string;
  kind: ContentKind;
  course_subject_id: string;
  description?: string | null;
  storage_path?: string | null;
  external_url?: string | null;
  body?: string | null;
};

// --- Tasks -----------------------------------------------------------------

export type Task = {
  id: string;
  school_id: string;
  course_subject_id: string;
  posted_by: string;
  title: string;
  description: string | null;
  due_at: string | null;
  max_score: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskSummary = Task & {
  course_subject_label: string;
  pending_submissions: number;
  total_submissions: number;
};

export type TaskSubmission = {
  id: string;
  school_id: string;
  task_id: string;
  student_id: string;
  body: string | null;
  file_path: string | null;
  status: TaskSubmissionStatus;
  submitted_at: string | null;
  grade: string | null;
  feedback: string | null;
  graded_by: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateTaskInput = {
  title: string;
  course_subject_id: string;
  description?: string | null;
  due_at?: string | null;
  max_score?: number | null;
};

export type UpsertTaskSubmissionInput = {
  task_id: string;
  body?: string | null;
  file_path?: string | null;
  status?: TaskSubmissionStatus;
};

export type GradeSubmissionInput = {
  submissionId: string;
  taskId: string;
  grade: number;
  feedback?: string | null;
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

export type SendChatMessageInput = {
  conversationId: string;
  body: string;
};
