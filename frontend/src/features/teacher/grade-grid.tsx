// =============================================================================
// The editable grade grid for a course subject and academic period.
// -----------------------------------------------------------------------------
// One row per enrolled student, one score each (Colombian 0-5 scale).
// Scores save on blur/Enter. Shared by the standalone Calificaciones
// page and the subject view's Calificaciones tab.
// =============================================================================

import { useMemo, useState } from "react";

import { EmptyHint } from "@/components/ui-kit";
import { useCourseRoster } from "@/features/teacher/use-course-roster";
import { useGrades, useRecordGrade } from "@/lib/grades/hooks";

export function GradeGrid({
  schoolId,
  courseSubjectId,
  courseId,
  courseName,
  periodId,
}: {
  schoolId: string;
  courseSubjectId: string;
  courseId: string;
  courseName: string;
  periodId: string;
}) {
  const roster = useCourseRoster(schoolId, courseId);
  const grades = useGrades(courseSubjectId, periodId);
  const recordGrade = useRecordGrade();

  // The grade already recorded per student for this course subject and period.
  const gradeByStudent = useMemo(() => {
    const map = new Map<string, { id: string; score: string }>();
    for (const g of grades.data ?? []) {
      if (g.academic_period_id === periodId) {
        map.set(g.student_id, { id: g.id, score: g.score });
      }
    }
    return map;
  }, [grades.data, periodId]);

  const isLoading = roster.isLoading || grades.isLoading;
  const error = roster.error ?? grades.error;

  if (isLoading) {
    return <p className="px-5 py-6 text-sm text-muted-foreground">Cargando grilla...</p>;
  }
  if (error) {
    return (
      <p role="alert" className="px-5 py-6 text-sm text-destructive">
        {error.message}
      </p>
    );
  }
  if (roster.students.length === 0) {
    return (
      <div className="p-5">
        <EmptyHint>
          No hay estudiantes activos inscriptos en {courseName}. Inscribí estudiantes en el curso
          para poder calificarlos.
        </EmptyHint>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="table-head-band text-left text-[11px] uppercase tracking-[0.09em]">
          <tr>
            <th className="sticky left-0 bg-muted px-5 py-3 font-semibold">Estudiante</th>
            <th className="px-3 py-3 font-semibold">Nota (0 a 5)</th>
            <th className="px-5 py-3 font-semibold">Estado</th>
          </tr>
        </thead>
        <tbody>
          {roster.students.map((student) => {
            const existing = gradeByStudent.get(student.studentId) ?? null;
            return (
              <GradeRow
                // Remounting when the server score changes re-seeds the
                // input from props without an effect.
                key={`${student.studentId}:${existing?.score ?? ""}`}
                name={student.name}
                existing={existing}
                onSave={(score) =>
                  recordGrade.mutate({
                    course_subject_id: courseSubjectId,
                    student_id: student.studentId,
                    academic_period_id: periodId,
                    score,
                  })
                }
                saving={recordGrade.isPending}
              />
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
        Las notas se guardan al salir del campo (Enter o clic afuera). Escala colombiana: 0 a 5.
      </p>
    </div>
  );
}

function GradeRow({
  name,
  existing,
  onSave,
  saving,
}: {
  name: string;
  existing: { id: string; score: string } | null;
  onSave: (score: number) => void;
  saving: boolean;
}) {
  const [value, setValue] = useState<string>(existing ? formatScore(existing.score) : "");
  const [invalid, setInvalid] = useState(false);

  function commit() {
    const trimmed = value.trim();
    if (trimmed === "") {
      setInvalid(false);
      return; // Empty means "leave as is"; we do not delete on blur.
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 5) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    // Only save when the value actually changed.
    if (!existing || Number(existing.score) !== parsed) {
      onSave(parsed);
    }
  }

  const recorded = existing !== null;

  return (
    <tr className="border-t border-border">
      <td className="sticky left-0 bg-card px-5 py-2.5 font-medium">{name}</td>
      <td className="px-3 py-2">
        <input
          inputMode="decimal"
          aria-label={`Nota de ${name}`}
          aria-invalid={invalid}
          value={value}
          disabled={saving}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={
            "w-20 rounded-md border bg-card px-2 py-1.5 text-center text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60 " +
            (invalid ? "border-destructive" : "border-input")
          }
        />
      </td>
      <td className="px-5 py-2.5 text-xs text-muted-foreground">
        {invalid ? (
          <span className="text-destructive">Debe ser un número entre 0 y 5</span>
        ) : recorded ? (
          "Guardada"
        ) : (
          "Sin calificar"
        )}
      </td>
    </tr>
  );
}

/** Trim trailing zeros from a decimal string: "4.00" -> "4", "3.50" -> "3.5". */
function formatScore(score: string): string {
  const n = Number(score);
  if (Number.isNaN(n)) return score;
  return String(n);
}
