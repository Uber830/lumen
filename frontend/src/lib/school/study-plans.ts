// =============================================================================
// The study plan of the school.
// -----------------------------------------------------------------------------
// The admin does not build the curriculum course by course: they pick the
// grades of the plan and the platform creates the courses with their
// subjects already offered.
//
// The import never duplicates. A course that already exists is skipped and
// the subjects of the school are reused.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** One grade of the study plan. */
export type StudyPlan = {
  /** The name of the course: "6° A". */
  course_name: string;
  /** The grade it stands for: "Sexto". */
  grade_label: string;
  /** The subjects the course is created with. */
  subjects: string[];
  subject_count: number;
  /** The students already enrolled in the course, when it exists. */
  enrolled_students: number;
  /** True when the school already has the course. */
  exists: boolean;
};

/** What the import did. */
export type StudyPlanImportResult = {
  created_courses: string[];
  skipped_courses: string[];
  created_subjects: number;
  offered_subjects: number;
};

export const studyPlanKeys = {
  plans: () => ["school", "study-plans"] as const,
};

/** The study plan, with what the school already has of it. */
export function useStudyPlans(): UseQueryResult<StudyPlan[], Error> {
  return useQuery({
    queryKey: studyPlanKeys.plans(),
    queryFn: () => api.get<StudyPlan[]>("/v1/academics/study-plans"),
  });
}

/** Import the picked grades of the plan: the courses are created at once. */
export function useImportStudyPlan(): UseMutationResult<StudyPlanImportResult, Error, string[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (courses: string[]) =>
      api.post<StudyPlanImportResult>("/v1/academics/study-plans/import", { courses }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: studyPlanKeys.plans() });
      // The new courses show up in the courses list and in the
      // course subjects of the assignments view.
      qc.invalidateQueries({ queryKey: ["courses"] });
      qc.invalidateQueries({ queryKey: ["course_subjects"] });
      qc.invalidateQueries({ queryKey: ["school", "courses"] });
      qc.invalidateQueries({ queryKey: ["school", "course-subjects"] });
    },
  });
}
