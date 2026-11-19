// =============================================================================
// The student's material.
// -----------------------------------------------------------------------------
// The content the teachers post to the course subjects the student is
// enrolled in, and the student's own progress on it.
//
// The API already decides what the student may read: a content item of
// a course subject the student is not enrolled in never reaches the
// browser. This module joins the names and keeps the progress.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { CourseSubjectSummary } from "@/features/academics/types";
import type { ContentItem, ContentProgress } from "@/lib/storage/types";

export const contentKeys = {
  mine: (schoolId: string) => ["my_content", schoolId] as const,
  progress: (schoolId: string) => ["my_content_progress", schoolId] as const,
};

/** A content item with the names of the course subject it belongs to. */
export type MyContentItem = ContentItem & {
  subject_name: string;
  course_name: string;
};

export function useMyContent(schoolId: string | null): UseQueryResult<MyContentItem[], Error> {
  return useQuery({
    queryKey: schoolId ? contentKeys.mine(schoolId) : ["my_content", "none"],
    enabled: !!schoolId,
    queryFn: async () => {
      const [items, courseSubjects] = await Promise.all([
        api.get<ContentItem[]>("/v1/content/items"),
        api.get<CourseSubjectSummary[]>("/v1/academics/course-subjects"),
      ]);

      const labels = new Map(
        courseSubjects.map((courseSubject) => [courseSubject.id, courseSubject]),
      );

      return items.map((item) => {
        const label = labels.get(item.course_subject_id);
        return {
          ...item,
          subject_name: label?.subject_name ?? "Materia",
          course_name: label?.course_name ?? "",
        };
      });
    },
  });
}

/** The content the student already completed. */
export function useMyContentProgress(
  schoolId: string | null,
): UseQueryResult<ContentProgress[], Error> {
  return useQuery({
    queryKey: schoolId ? contentKeys.progress(schoolId) : ["my_content_progress", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<ContentProgress[]>("/v1/content/progress"),
  });
}

/**
 * Mark a content item as completed.
 *
 * The API keeps it idempotent: marking twice returns the same row.
 */
export function useMarkContentCompleted(
  schoolId: string,
): UseMutationResult<ContentProgress, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contentItemId: string) =>
      api.post<ContentProgress>(`/v1/content/items/${contentItemId}/progress`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.progress(schoolId) });
    },
  });
}

/** Take the mark of a content item back. */
export function useUnmarkContentCompleted(
  schoolId: string,
): UseMutationResult<void, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contentItemId: string) =>
      api.delete<void>(`/v1/content/items/${contentItemId}/progress`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: contentKeys.progress(schoolId) });
    },
  });
}
