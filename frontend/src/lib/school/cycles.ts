// =============================================================================
// The academic cycle of the school: its assignments and its periods.
// -----------------------------------------------------------------------------
// An assignment ties a teacher to a course subject: it is what enables
// the access to the content. A period is the cycle: it has one current
// period at a time, and closing it takes the material of the cycle out
// of the active material.
//
// Closing a period and marking one as current are the principal's: the
// API refuses them to the secondary, and the interface disables the
// button with the reason.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** One assignment, with the material the teacher sees through it. */
export type SchoolAssignment = {
  id: string;
  teacher_id: string;
  teacher_name: string | null;
  teacher_email: string | null;
  teacher_avatar_url: string | null;
  course_id: string;
  course_name: string;
  subject_id: string;
  subject_name: string;
  subject_area: string | null;
  /** How many pieces of material the teacher sees through it. */
  visible_materials_count: number;
};

/** One academic period of the school. */
export type SchoolPeriod = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  modality: string;
  delivery_modality: string | null;
  /** vigente, cerrado or future. */
  status: "vigente" | "cerrado" | "future";
  is_current: boolean;
  closed_at: string | null;
};

/** The answer of a close. */
export type PeriodClosed = {
  id: string;
  name: string;
  closed_at: string;
  archived_materials: number;
};

export const cycleKeys = {
  assignments: (teacherId?: string, courseId?: string) =>
    ["school", "assignments", teacherId ?? "all", courseId ?? "all"] as const,
  periods: () => ["school", "periods"] as const,
};

/** The assignments of the school, with the material each one sees. */
export function useSchoolAssignments(
  teacherId?: string,
  courseId?: string,
): UseQueryResult<SchoolAssignment[], Error> {
  return useQuery({
    queryKey: cycleKeys.assignments(teacherId, courseId),
    queryFn: () => {
      const params = new URLSearchParams();
      if (teacherId && teacherId !== "all") params.set("teacher_id", teacherId);
      if (courseId && courseId !== "all") params.set("course_id", courseId);
      const query = params.toString();
      return api.get<SchoolAssignment[]>(
        query ? `/v1/school/assignments?${query}` : "/v1/school/assignments",
      );
    },
  });
}

/** The periods of the school, the current one first. */
export function useSchoolPeriods(): UseQueryResult<SchoolPeriod[], Error> {
  return useQuery({
    queryKey: cycleKeys.periods(),
    queryFn: () => api.get<SchoolPeriod[]>("/v1/school/periods"),
  });
}

/** Close a period: the material of the cycle leaves the active material. */
export function useClosePeriod(): UseMutationResult<PeriodClosed, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: string) =>
      api.post<PeriodClosed>(`/v1/school/periods/${periodId}/close`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.periods() });
      // The material of the school changes when a cycle is closed.
      qc.invalidateQueries({ queryKey: ["school", "material"] });
      qc.invalidateQueries({ queryKey: ["school", "assignments"] });
    },
  });
}

/** Mark a period as the current one: the previous one is closed. */
export function useSetCurrentPeriod(): UseMutationResult<
  { id: string; name: string; closed_previous: string[] },
  Error,
  string
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (periodId: string) =>
      api.post<{ id: string; name: string; closed_previous: string[] }>(
        `/v1/school/periods/${periodId}/set-current`,
        {},
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cycleKeys.periods() });
      qc.invalidateQueries({ queryKey: ["school", "material"] });
      qc.invalidateQueries({ queryKey: ["school", "assignments"] });
    },
  });
}
