import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, SectionCard, EmptyHint } from "@/components/ui-kit";
import { useAcademicPeriods } from "@/features/academics/hooks";
import {
  useMyCourseSubjects,
  type MyCourseSubject,
} from "@/features/teacher/use-my-course-subjects";
import { GradeGrid } from "@/features/teacher/grade-grid";
import type { AcademicPeriod } from "@/features/academics/types";

export const Route = createFileRoute("/docente/calificaciones")({
  head: () => ({
    meta: [
      { title: "Calificaciones — Lumen" },
      { name: "description", content: "Grilla editable de calificaciones por materia y período." },
      { property: "og:title", content: "Calificaciones — Lumen" },
      { property: "og:description", content: "Cargá y ajustá notas como en una planilla." },
    ],
  }),
  component: Calificaciones,
});

function Calificaciones() {
  const { session } = useRouteContext({ from: "/docente/calificaciones" });
  const schoolId = session.primarySchoolId;
  const teacherId = session.user.id;

  const myCourseSubjects = useMyCourseSubjects(schoolId, teacherId);
  const periods = useAcademicPeriods(schoolId);

  // The user's explicit choice, or null to mean "use the default".
  // Deriving the effective value during render (instead of syncing it
  // into state from an effect) avoids cascading re-renders.
  const [pickedSubjectId, setPickedSubjectId] = useState<string | null>(null);
  const [pickedPeriodId, setPickedPeriodId] = useState<string | null>(null);

  const defaultSubjectId = myCourseSubjects.items[0]?.id ?? "";
  const defaultPeriodId = (periods.data?.find((p) => p.is_current) ?? periods.data?.[0])?.id ?? "";

  const courseSubjectId =
    pickedSubjectId && myCourseSubjects.items.some((cs) => cs.id === pickedSubjectId)
      ? pickedSubjectId
      : defaultSubjectId;
  const periodId =
    pickedPeriodId && (periods.data ?? []).some((p) => p.id === pickedPeriodId)
      ? pickedPeriodId
      : defaultPeriodId;

  if (!schoolId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio.
        </p>
      </div>
    );
  }

  const selected = myCourseSubjects.items.find((cs) => cs.id === courseSubjectId) ?? null;
  const selectedPeriod = periods.data?.find((p) => p.id === periodId) ?? null;

  return (
    <>
      <PageHeader
        title="Calificaciones"
        subtitle={
          selected
            ? `${selected.subject_name} · ${selected.course_name}${selectedPeriod ? ` · ${selectedPeriod.name}` : ""}`
            : "Seleccioná una materia"
        }
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap gap-3 border-b border-border p-4">
          <SubjectSelect
            items={myCourseSubjects.items}
            value={courseSubjectId}
            onChange={setPickedSubjectId}
            loading={myCourseSubjects.isLoading}
          />
          <PeriodSelect
            periods={periods.data ?? []}
            value={periodId}
            onChange={setPickedPeriodId}
            loading={periods.isLoading}
          />
        </div>

        {myCourseSubjects.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando tus materias...</p>
        ) : myCourseSubjects.items.length === 0 ? (
          <div className="p-5">
            <EmptyHint>
              No tenés materias asignadas. El administrador debe asignarte a un curso y materia
              antes de poder cargar notas.
            </EmptyHint>
          </div>
        ) : !selected || !periodId ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Elegí una materia y un período para ver la grilla.
          </p>
        ) : (
          <GradeGrid
            schoolId={schoolId}
            courseSubjectId={selected.id}
            courseId={selected.course_id}
            courseName={selected.course_name}
            periodId={periodId}
          />
        )}
      </SectionCard>
    </>
  );
}

function SubjectSelect({
  items,
  value,
  onChange,
  loading,
}: {
  items: MyCourseSubject[];
  value: string;
  onChange: (id: string) => void;
  loading: boolean;
}) {
  return (
    <select
      aria-label="Materia"
      disabled={loading || items.length === 0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-input bg-card px-3 py-2 text-sm disabled:opacity-60"
    >
      {items.length === 0 && <option value="">Sin materias</option>}
      {items.map((cs) => (
        <option key={cs.id} value={cs.id}>
          {cs.subject_name} · {cs.course_name}
        </option>
      ))}
    </select>
  );
}

function PeriodSelect({
  periods,
  value,
  onChange,
  loading,
}: {
  periods: AcademicPeriod[];
  value: string;
  onChange: (id: string) => void;
  loading: boolean;
}) {
  return (
    <select
      aria-label="Período"
      disabled={loading || periods.length === 0}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-input bg-card px-3 py-2 text-sm disabled:opacity-60"
    >
      {periods.length === 0 && <option value="">Sin períodos</option>}
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
          {p.is_current ? " (actual)" : ""}
        </option>
      ))}
    </select>
  );
}
