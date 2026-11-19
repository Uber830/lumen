// =============================================================================
// The teachers of a student.
// -----------------------------------------------------------------------------
// A student writes to the teachers of their own courses. The API
// returns only those teachers, with the subjects they teach that
// student: a student does not get the staff directory of the school.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { StudentTeacher } from "@/lib/api/types";

export const myTeachersKeys = {
  list: (schoolId: string) => ["my_teachers", schoolId] as const,
};

export function useMyTeachers(schoolId: string | null): UseQueryResult<StudentTeacher[], Error> {
  return useQuery({
    queryKey: schoolId ? myTeachersKeys.list(schoolId) : ["my_teachers", "none"],
    enabled: !!schoolId,
    queryFn: () => api.get<StudentTeacher[]>("/v1/academics/my-teachers"),
  });
}
