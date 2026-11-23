// =============================================================================
// The hooks for content, tasks and chat.
// -----------------------------------------------------------------------------
// These used to read and write PostgREST directly from the browser.
// They talk to the API now.
//
// The permissions are enforced by the API: a teacher reaches the
// material of the course subjects they teach, a student the courses
// they are enrolled in.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type {
  ChatConversation,
  ChatMessage,
  ContentItem,
  CreateContentItemInput,
  CreateTaskInput,
  GradeSubmissionInput,
  SendChatMessageInput,
  Task,
  TaskSubmission,
  TaskSummary,
  UpsertTaskSubmissionInput,
} from "@/lib/storage/types";

export type { ChatConversation, ChatMessage, ContentItem, Task, TaskSubmission };

/** How often the messages of a conversation are refreshed, in milliseconds. */
export const CHAT_POLL_INTERVAL = 5_000;

export const queryKeys = {
  contentItems: (schoolId: string) => ["content_items", schoolId] as const,
  contentItemsByCourseSubject: (courseSubjectId: string) =>
    ["content_items", "by_course_subject", courseSubjectId] as const,
  tasks: (schoolId: string) => ["tasks", schoolId] as const,
  tasksByCourseSubject: (courseSubjectId: string) =>
    ["tasks", "by_course_subject", courseSubjectId] as const,
  submissionsByTask: (taskId: string) => ["task_submissions", "by_task", taskId] as const,
  mySubmission: (taskId: string, studentId: string) =>
    ["task_submissions", "mine", taskId, studentId] as const,
  conversations: (schoolId: string) => ["chat_conversations", schoolId] as const,
  messages: (conversationId: string) => ["chat_messages", conversationId] as const,
};

// ---------------------------------------------------------------------------
// content_items
// ---------------------------------------------------------------------------

export function useContentItems(
  schoolId: string | null,
  courseSubjectId?: string | null,
): UseQueryResult<ContentItem[], Error> {
  return useQuery({
    queryKey: courseSubjectId
      ? queryKeys.contentItemsByCourseSubject(courseSubjectId)
      : schoolId
        ? queryKeys.contentItems(schoolId)
        : ["content_items", "none"],
    enabled: !!schoolId,
    queryFn: () =>
      api.get<ContentItem[]>(
        "/v1/content/items",
        courseSubjectId ? { course_subject_id: courseSubjectId } : undefined,
      ),
  });
}

export function useCreateContentItem(
  schoolId: string,
): UseMutationResult<ContentItem, Error, CreateContentItemInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<ContentItem>("/v1/content/items", input),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: queryKeys.contentItems(schoolId) });
      qc.invalidateQueries({
        queryKey: queryKeys.contentItemsByCourseSubject(item.course_subject_id),
      });
    },
  });
}

export function useDeleteContentItem(schoolId: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/content/items/${id}`),
    onSuccess: () => {
      // The deleted item's course subject is unknown here, so refresh
      // both the school-wide list and any course-subject-scoped lists.
      qc.invalidateQueries({ queryKey: queryKeys.contentItems(schoolId) });
      qc.invalidateQueries({ queryKey: ["content_items", "by_course_subject"] });
    },
  });
}

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export function useTasks(
  schoolId: string | null,
  courseSubjectId?: string | null,
): UseQueryResult<TaskSummary[], Error> {
  return useQuery({
    queryKey: courseSubjectId
      ? queryKeys.tasksByCourseSubject(courseSubjectId)
      : schoolId
        ? queryKeys.tasks(schoolId)
        : ["tasks", "none"],
    enabled: !!schoolId,
    queryFn: () =>
      api.get<TaskSummary[]>(
        "/v1/tasks",
        courseSubjectId ? { course_subject_id: courseSubjectId } : undefined,
      ),
  });
}

export function useCreateTask(schoolId: string): UseMutationResult<Task, Error, CreateTaskInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Task>("/v1/tasks", input),
    onSuccess: (task) => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(schoolId) });
      qc.invalidateQueries({ queryKey: queryKeys.tasksByCourseSubject(task.course_subject_id) });
    },
  });
}

export function useDeleteTask(schoolId: string): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete<void>(`/v1/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tasks(schoolId) });
      qc.invalidateQueries({ queryKey: ["tasks", "by_course_subject"] });
    },
  });
}

// ---------------------------------------------------------------------------
// task_submissions
// ---------------------------------------------------------------------------

export function useTaskSubmissions(taskId: string | null): UseQueryResult<TaskSubmission[], Error> {
  return useQuery({
    queryKey: taskId ? queryKeys.submissionsByTask(taskId) : ["task_submissions", "none"],
    enabled: !!taskId,
    queryFn: () => api.get<TaskSubmission[]>("/v1/tasks/submissions", { task_id: taskId }),
  });
}

export function useUpsertTaskSubmission(
  schoolId: string,
): UseMutationResult<TaskSubmission, Error, UpsertTaskSubmissionInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) =>
      api.post<TaskSubmission>(
        "/v1/tasks/submissions",
        {
          body: input.body ?? null,
          file_path: input.file_path ?? null,
          status: input.status ?? "submitted",
        },
        { task_id: input.task_id },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.submissionsByTask(vars.task_id) });
      qc.invalidateQueries({ queryKey: queryKeys.tasks(schoolId) });
    },
  });
}

/**
 * Grade a submission (teacher action).
 *
 * The backend only lets the teacher of the task's course subject set
 * the grade and feedback; a student cannot grade their own. Marks the
 * submission "graded".
 */
export function useGradeSubmission(): UseMutationResult<
  TaskSubmission,
  Error,
  GradeSubmissionInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ submissionId, grade, feedback }) =>
      api.patch<TaskSubmission>(`/v1/tasks/submissions/${submissionId}`, {
        grade,
        feedback: feedback ?? null,
        status: "graded",
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.submissionsByTask(vars.taskId) });
    },
  });
}

// ---------------------------------------------------------------------------
// chat
// ---------------------------------------------------------------------------

export function useChatConversations(
  schoolId: string | null,
): UseQueryResult<ChatConversation[], Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.conversations(schoolId) : ["chat_conversations", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<ChatConversation[]>("/v1/chat/conversations"),
  });
}

/**
 * The messages of a conversation.
 *
 * The panel refreshes them every few seconds: there is no push channel,
 * and a message that arrives is read the same way whether it was
 * written a second ago or a minute ago.
 */
export function useChatMessages(
  conversationId: string | null,
): UseQueryResult<ChatMessage[], Error> {
  return useQuery({
    queryKey: conversationId ? queryKeys.messages(conversationId) : ["chat_messages", "none"],
    enabled: !!conversationId,
    queryFn: () => api.get<ChatMessage[]>(`/v1/chat/conversations/${conversationId}/messages`),
    refetchInterval: CHAT_POLL_INTERVAL,
    refetchIntervalInBackground: false,
  });
}

export function useSendChatMessage(
  schoolId: string,
): UseMutationResult<ChatMessage, Error, SendChatMessageInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, body }) =>
      api.post<ChatMessage>(`/v1/chat/conversations/${conversationId}/messages`, { body }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.messages(vars.conversationId) });
      qc.invalidateQueries({ queryKey: queryKeys.conversations(schoolId) });
    },
  });
}
