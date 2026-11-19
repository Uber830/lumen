// =============================================================================
// The student's submissions.
// -----------------------------------------------------------------------------
// A student has one submission per task. The first save creates it and
// the next ones update it: the API refuses a second submission for the
// same task, so the UI has to know whether the student already sent one.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { TaskSubmission } from "@/lib/storage/types";

export const submissionKeys = {
  mine: (schoolId: string) => ["task_submissions", "mine", schoolId] as const,
};

/**
 * The submissions of the signed-in student.
 *
 * The API already filters them: a student only ever reads their own.
 */
export function useMySubmissions(schoolId: string | null): UseQueryResult<TaskSubmission[], Error> {
  return useQuery({
    queryKey: schoolId ? submissionKeys.mine(schoolId) : ["task_submissions", "mine", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<TaskSubmission[]>("/v1/tasks/submissions"),
  });
}

/**
 * Create or update the student's submission of a task.
 *
 * `submissionId` decides which one it is: with it, the submission is
 * updated; without it, it is created.
 */
export function useSaveSubmission(schoolId: string): UseMutationResult<
  TaskSubmission,
  Error,
  {
    taskId: string;
    submissionId?: string | null;
    body?: string | null;
    filePath?: string | null;
  }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, submissionId, body, filePath }) => {
      const payload = {
        body: body ?? null,
        file_path: filePath ?? null,
        status: "submitted",
      };
      return submissionId
        ? api.patch<TaskSubmission>(`/v1/tasks/submissions/${submissionId}`, payload)
        : api.post<TaskSubmission>("/v1/tasks/submissions", payload, { task_id: taskId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: submissionKeys.mine(schoolId) });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
