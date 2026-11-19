// =============================================================================
// The student grade sheet.
// -----------------------------------------------------------------------------
// The grades of a student, grouped by course subject.
//
// The browser used to assemble this from two PostgREST queries and a
// join. The API does it in one query now.
//
// The API sends the scores as strings: they are decimals in the
// database, and a string keeps the exact value. This hook converts
// them to numbers, which is what the UI works with.
// =============================================================================

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { StudentGrades, StudentGradeRow, StudentGradesResponse } from "@/lib/grades/types";

export type { StudentGrades, StudentGradeRow };

/** Turn a decimal string into a number, keeping null as null. */
function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function useStudentGrades(
  schoolId: string | null,
  studentId: string | null,
): UseQueryResult<StudentGrades, Error> {
  return useQuery({
    queryKey:
      schoolId && studentId ? ["student_grades", schoolId, studentId] : ["student_grades", "none"],
    enabled: !!schoolId && !!studentId,
    queryFn: async () => {
      const response = await api.get<StudentGradesResponse>(`/v1/grades/students/${studentId}`);

      return {
        rows: response.rows.map((row) => ({
          course_subject_id: row.course_subject_id,
          subject_name: row.subject_name,
          subject_area: row.subject_area,
          grades: Object.fromEntries(
            Object.entries(row.grades).map(([period, score]) => [period, toNumber(score)]),
          ),
          average: toNumber(row.average),
        })),
        periods: response.periods,
      };
    },
  });
}
