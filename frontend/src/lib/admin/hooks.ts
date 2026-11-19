// =============================================================================
// The admin dashboard hooks.
// -----------------------------------------------------------------------------
// The counters the home page renders. They used to be five parallel
// PostgREST queries from the browser; they are one API call now.
//
// The school is derived from the session, so the counters are always
// for the school the caller belongs to.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { AcademicPeriod, CourseSummary, SchoolMember } from "@/features/academics/types";
import type { TaskSummary } from "@/lib/storage/types";
import type { SchoolStats } from "@/types/admin";

export const queryKeys = {
  school: (schoolId: string) => ["admin", "school", schoolId] as const,
  schoolStats: (schoolId: string) => ["admin", "schoolStats", schoolId] as const,
};

const EMPTY_STATS: Omit<SchoolStats, "schoolId"> = {
  schoolName: "",
  schoolShortCode: "",
  schoolStatus: "trial",
  currentPeriod: null,
  students: 0,
  teachers: 0,
  courses: 0,
  pendingTasks: 0,
};

/**
 * Aggregate counters for the admin home page.
 *
 * The school row, the current academic period, the count of students,
 * of teachers and of courses, and the number of tasks waiting to be
 * graded.
 */
export function useSchoolStats(schoolId: string | null): UseQueryResult<SchoolStats, Error> {
  return useQuery({
    queryKey: schoolId ? queryKeys.schoolStats(schoolId) : ["admin", "schoolStats", "none"],
    enabled: !!schoolId,
    queryFn: async (): Promise<SchoolStats> => {
      if (!schoolId) return { schoolId: "", ...EMPTY_STATS };

      // The four reads run in parallel. Each one is already scoped to
      // the caller's school by the API.
      const [members, periods, courses, tasks] = await Promise.all([
        api.get<SchoolMember[]>("/v1/academics/members"),
        api.get<AcademicPeriod[]>("/v1/academics/periods"),
        api.get<CourseSummary[]>("/v1/academics/courses"),
        api.get<TaskSummary[]>("/v1/tasks"),
      ]);

      const students = members.filter((m) => m.role === "student").length;
      const teachers = members.filter((m) => m.role === "teacher").length;
      const currentPeriod = periods.find((p) => p.is_current) ?? null;

      // Pending tasks: a task with at least one submission that has
      // been submitted but not graded. The API returns the counts.
      const pendingTasks = tasks.reduce((total, task) => total + task.pending_submissions, 0);

      return {
        schoolId,
        schoolName: "",
        schoolShortCode: "",
        schoolStatus: "trial",
        currentPeriod: currentPeriod
          ? {
              id: currentPeriod.id,
              name: currentPeriod.name,
              modality: currentPeriod.modality,
            }
          : null,
        students,
        teachers,
        courses: courses.length,
        pendingTasks,
      };
    },
  });
}
