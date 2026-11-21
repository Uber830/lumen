// =============================================================================
// The overview of the school: the dashboard in a single call.
// -----------------------------------------------------------------------------
// The dashboard is the view that suffers the most in mobile, so it asks
// for everything at once instead of four round trips: the indicators,
// the material by area, the state of the school and the recent activity.
//
// The numbers come from the backend and belong to the caller's own
// school: the school id is never sent, the API deduces it from the
// session.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";

/** How much enabled material there is in one area. */
export type MaterialAreaCount = {
  area: string;
  count: number;
};

/** The material of the school, and the size of the whole catalog. */
export type MaterialOverview = {
  available: number;
  catalog_total: number;
  by_area: MaterialAreaCount[];
  last_enabled_at: string | null;
};

/** The community of teachers. */
export type TeachersOverview = {
  total: number;
  with_access: number;
  pending: number;
};

/** The students of the school. */
export type StudentsOverview = {
  total: number;
  with_access: number;
  courses: number;
};

/** The work that is waiting for the school. */
export type TasksOverview = {
  pending: number;
  stale: number;
};

/** The period the school is in. */
export type PeriodOverview = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
};

/** One event of the recent activity of the school. */
export type ActivityEntry = {
  icon: string;
  tone: string;
  title: string;
  detail: string;
  at: string;
};

/** Everything the dashboard of the school shows. */
export type SchoolOverview = {
  material: MaterialOverview;
  teachers: TeachersOverview;
  students: StudentsOverview;
  tasks: TasksOverview;
  courses: number;
  period: PeriodOverview | null;
  activity: ActivityEntry[];
};

export const overviewKeys = {
  all: (schoolId: string | null) => ["school", "overview", schoolId ?? "none"] as const,
};

/**
 * The overview of the school.
 *
 * The query is only enabled for a caller that belongs to a school: the
 * endpoint is the panel of the administrator, and the other roles do
 * not have it.
 */
export function useSchoolOverview(schoolId: string | null): UseQueryResult<SchoolOverview, Error> {
  return useQuery({
    queryKey: overviewKeys.all(schoolId),
    enabled: Boolean(schoolId),
    queryFn: () => api.get<SchoolOverview>("/v1/school/overview"),
  });
}
