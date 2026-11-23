// =============================================================================
// The simulators of the school: what the platform enabled, what the school
// activated.
// -----------------------------------------------------------------------------
// The catalog lives in three layers and the school only touches the last one:
// the platform team publishes the simulator, the platform team enables it for
// the school, and the school decides in which courses it runs and until when.
//
// The school id is never sent: the API deduces it from the session.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** One course where a simulator of the school runs. */
export type SimulatorActivation = {
  course_id: string;
  course_name: string;
  deadline: string;
  activated_at: string;
};

/** A simulator the platform team enabled for the school. */
export type SchoolSimulator = {
  id: string;
  code: string;
  name: string;
  grade: string;
  question_count: number;
  duration_min: number;
  scheduled_at: string | null;
  /** publicado, en_curso or cerrado. */
  status: string;
  /** Null until the exam is corrected. */
  average_score: number | null;
  enabled_at: string | null;
  activated: boolean;
  activations: SimulatorActivation[];
};

/** The average score of one grade, on the scale of the exam. */
export type GradeAverage = {
  grade: string;
  average_score: number;
  /** The score of the last cut of the grade. */
  latest_average: number;
  /** The score of the cut before it, when there is one. */
  previous_average: number | null;
  /** How many points the last cut gained over the previous one. */
  delta: number | null;
};

/** The indicators of the view. */
export type IcfesKpis = {
  available: number;
  not_activated: number;
  activated: number;
  activated_courses: number;
  averages_by_grade: GradeAverage[];
  max_score: number;
};

/** The simulators of the school, with their indicators. */
export type SchoolSimulators = {
  items: SchoolSimulator[];
  kpis: IcfesKpis;
};

/** The result of a simulator in one of its courses. */
export type SimulatorCourseResult = SimulatorActivation & {
  students: number;
  average_score: number | null;
};

/** A simulator with the result of each course it runs in. */
export type SimulatorResults = {
  id: string;
  code: string;
  name: string;
  grade: string;
  question_count: number;
  duration_min: number;
  scheduled_at: string | null;
  status: string;
  average_score: number | null;
  max_score: number;
  courses: SimulatorCourseResult[];
};

/** What the school asks for when it activates a simulator. */
export type ActivationRequest = {
  course_ids: string[];
  deadline: string;
};

export const icfesKeys = {
  simulators: () => ["school", "icfes"] as const,
  results: (simulatorId: string) => ["school", "icfes", simulatorId, "results"] as const,
};

/** The simulators enabled for the school. */
export function useSchoolSimulators(): UseQueryResult<SchoolSimulators, Error> {
  return useQuery({
    queryKey: icfesKeys.simulators(),
    queryFn: () => api.get<SchoolSimulators>("/v1/school/icfes"),
  });
}

/** The result of a simulator in each course it runs in. */
export function useSimulatorResults(
  simulatorId: string | null,
): UseQueryResult<SimulatorResults, Error> {
  return useQuery({
    queryKey: icfesKeys.results(simulatorId ?? "none"),
    enabled: Boolean(simulatorId),
    queryFn: () => api.get<SimulatorResults>(`/v1/school/icfes/${simulatorId}/results`),
  });
}

/** Activate a simulator in some courses of the school. */
export function useActivateSimulator(): UseMutationResult<
  { simulator_id: string; courses: string[]; deadline: string },
  Error,
  { simulatorId: string } & ActivationRequest
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ simulatorId, course_ids, deadline }) =>
      api.post<{ simulator_id: string; courses: string[]; deadline: string }>(
        `/v1/school/icfes/${simulatorId}/activations`,
        { course_ids, deadline },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: icfesKeys.simulators() });
    },
  });
}
