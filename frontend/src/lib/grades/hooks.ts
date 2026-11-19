// =============================================================================
// Grade hooks for the teacher's grade sheet.
// -----------------------------------------------------------------------------
// The grades of a course subject (one subject taught in one course),
// used by the teacher's editable grade grid. The student-facing sheet
// lives in `./student.ts`; this file is the per-course-subject view a
// teacher records against.
//
// Scores are decimals on the Colombian 0-5 scale. The API sends and
// receives them as strings to keep the exact value; the UI parses
// them to numbers where it needs to compute averages.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { Grade, RecordGradeInput, UpdateGradeInput } from "@/lib/grades/types";

export type { RecordGradeInput, UpdateGradeInput };

/** The query key for the grades of a course subject (optionally a period). */
export function gradesKey(courseSubjectId: string, academicPeriodId?: string | null) {
  return ["grades", courseSubjectId, academicPeriodId ?? "all"] as const;
}

/**
 * The grades recorded for a course subject.
 *
 * The backend scopes reads to what the caller may see: for a teacher
 * that is the course subjects they are assigned to. Pass an academic
 * period to narrow the grid to a single term.
 */
export function useGrades(
  courseSubjectId: string | null,
  academicPeriodId?: string | null,
): UseQueryResult<Grade[], Error> {
  return useQuery({
    queryKey: courseSubjectId ? gradesKey(courseSubjectId, academicPeriodId) : ["grades", "none"],
    enabled: !!courseSubjectId,
    queryFn: () =>
      api.get<Grade[]>("/v1/grades", {
        course_subject_id: courseSubjectId as string,
        ...(academicPeriodId ? { academic_period_id: academicPeriodId } : {}),
      }),
  });
}

/**
 * Record a grade. Writing a grade that already exists for the same
 * student, course subject and period updates it (the backend upserts),
 * so this one mutation covers both "new note" and "changed note".
 */
export function useRecordGrade(): UseMutationResult<Grade, Error, RecordGradeInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input) => api.post<Grade>("/v1/grades", input),
    onSuccess: (grade) => {
      // Refresh both the period-scoped and the all-periods views.
      qc.invalidateQueries({ queryKey: gradesKey(grade.course_subject_id) });
      qc.invalidateQueries({
        queryKey: gradesKey(grade.course_subject_id, grade.academic_period_id),
      });
    },
  });
}

/** Patch an existing grade by id (score and/or notes). */
export function useUpdateGrade(): UseMutationResult<Grade, Error, UpdateGradeInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }) => api.patch<Grade>(`/v1/grades/${id}`, patch),
    onSuccess: (grade) => {
      qc.invalidateQueries({ queryKey: gradesKey(grade.course_subject_id) });
      qc.invalidateQueries({
        queryKey: gradesKey(grade.course_subject_id, grade.academic_period_id),
      });
    },
  });
}
