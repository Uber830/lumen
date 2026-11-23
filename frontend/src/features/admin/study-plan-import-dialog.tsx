// =============================================================================
// The study plan import (admin).
// -----------------------------------------------------------------------------
// Opens from the assignments view: the admin picks the grades of the study
// plan and the platform creates the courses with their subjects offered.
//
// The grid is the one of the reference prototype: one card per grade, the
// ones the school already has are marked, and nothing is duplicated.
//
// A self-contained overlay (the pattern used elsewhere in the app) rather
// than the Radix dialog barrel, which the current bundler does not resolve
// from the route graph.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { Check, X } from "lucide-react";

import { Button, Chip } from "@/components/ui-kit";
import { useImportStudyPlan, useStudyPlans, type StudyPlan } from "@/lib/school/study-plans";

export function StudyPlanImportDialog({
  onClose,
  onImported,
}: {
  onClose: () => void;
  /** Called with the message the view shows when the import is done. */
  onImported: (message: string) => void;
}) {
  const plans = useStudyPlans();
  const importPlan = useImportStudyPlan();

  // The grades the admin picked. A course that already exists can still be
  // picked: the import skips it and says so.
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(name: string) {
    setPicked((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  }

  const courses = useMemo(() => picked, [picked]);

  async function onImport() {
    if (courses.length === 0) return;
    try {
      const result = await importPlan.mutateAsync(courses);
      const created = result.created_courses.length;
      const skipped = result.skipped_courses.length;
      const message = [
        created > 0
          ? `${created} ${created === 1 ? "curso creado" : "cursos creados"}`
          : "Ese curso ya existía",
        skipped > 0 && created > 0 ? ` · ${skipped} ya existían` : "",
      ].join("");
      onImported(message);
      onClose();
    } catch {
      // Surfaced below via importPlan.error.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Importar plan de estudios"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-lg bg-card p-5 sm:rounded-lg sm:p-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Importar plan de estudios</h2>
            <p className="text-sm text-muted-foreground">
              Se crean los cursos del plan y quedan listos para asignar docentes.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="mt-5">
          {plans.isLoading ? (
            <div className="grid gap-2 sm:grid-cols-2" aria-hidden>
              {[0, 1, 2, 3].map((row) => (
                <div key={row} className="h-[62px] animate-pulse rounded-idx bg-muted" />
              ))}
            </div>
          ) : plans.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {plans.error.message}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(plans.data ?? []).map((plan) => (
                <PlanPick
                  key={plan.course_name}
                  plan={plan}
                  selected={picked.includes(plan.course_name)}
                  onToggle={() => toggle(plan.course_name)}
                />
              ))}
            </div>
          )}

          <p className="mt-3 text-xs text-muted-foreground">
            Los cursos que ya existen no se duplican.
          </p>

          {importPlan.error && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {importPlan.error.message}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            icon={Check}
            onClick={onImport}
            disabled={courses.length === 0 || importPlan.isPending}
          >
            {importPlan.isPending ? "Creando cursos..." : "Crear cursos"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PlanPick({
  plan,
  selected,
  onToggle,
}: {
  plan: StudyPlan;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={
        "flex items-start gap-3 rounded-idx border px-3 py-2.5 text-left transition-colors " +
        (selected ? "border-primary bg-primary-soft/40" : "border-border bg-card hover:bg-muted/60")
      }
    >
      <span
        aria-hidden
        className={
          "mt-0.5 grid size-4 shrink-0 place-items-center rounded-[3px] border text-[10px] " +
          (selected ? "border-primary bg-primary text-primary-foreground" : "border-input")
        }
      >
        {selected ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">{plan.course_name}</span>
          {plan.exists && <Chip tone="muted">Ya existe</Chip>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {plan.subject_count} {plan.subject_count === 1 ? "materia" : "materias"} ·{" "}
          {plan.enrolled_students} {plan.enrolled_students === 1 ? "estudiante" : "estudiantes"}
        </span>
      </span>
    </button>
  );
}
