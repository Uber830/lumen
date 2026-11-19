import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useMemo } from "react";
import { PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { useStudentGrades } from "@/lib/grades/student";

export const Route = createFileRoute("/estudiante/notas")({
  head: () => ({
    meta: [
      { title: "Mis notas — Lumen" },
      {
        name: "description",
        content: "Calificaciones por materia y período con promedio general.",
      },
      { property: "og:title", content: "Mis notas — Lumen" },
      {
        property: "og:description",
        content: "Seguí tu rendimiento académico trimestre a trimestre.",
      },
    ],
  }),
  component: Notas,
});

function Notas() {
  const { session } = useRouteContext({ from: "/estudiante/notas" });
  const schoolId = session.primarySchoolId;
  const studentId = session.user.id;
  const grades = useStudentGrades(schoolId, studentId);
  const data = grades.data;
  const periodNames = useMemo(() => data?.periods.map((p) => p.name) ?? [], [data]);
  const overallAverage = useMemo(() => {
    if (!data || data.rows.length === 0) return null;
    const avgs = data.rows.map((r) => r.average).filter((n): n is number => n !== null);
    if (avgs.length === 0) return null;
    return avgs.reduce((acc, n) => acc + n, 0) / avgs.length;
  }, [data]);
  const approvedCount =
    data?.rows.filter((r) => r.average !== null && r.average >= 3.0).length ?? 0;

  if (!schoolId || !studentId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Mis notas" subtitle="Calificaciones por materia y período" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Promedio general"
          value={overallAverage !== null ? overallAverage.toFixed(2) : "—"}
          delta={overallAverage !== null ? "Sobre 5.00" : "Sin notas cargadas"}
          tone={overallAverage !== null && overallAverage >= 4 ? "success" : "warning"}
        />
        <StatCard
          label="Materias registradas"
          value={`${data?.rows.length ?? 0}`}
          delta={`${approvedCount} aprobadas`}
          tone="primary"
        />
        <StatCard
          label="Períodos"
          value={`${periodNames.length}`}
          delta={periodNames.join(", ") || "—"}
        />
      </div>

      <SectionCard title="Calificaciones por materia" bodyClassName="p-0">
        {grades.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando notas...</p>
        ) : grades.error ? (
          <p role="alert" className="px-5 py-6 text-sm text-destructive">
            {grades.error.message}
          </p>
        ) : !data || data.rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Todavia no hay notas registradas para vos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-5 py-3 font-semibold">Materia</th>
                  {periodNames.map((name) => (
                    <th key={name} className="px-3 py-3 font-semibold">
                      {name}
                    </th>
                  ))}
                  <th className="px-3 py-3 font-semibold">Promedio</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.course_subject_id} className="border-t border-border">
                    <td className="px-5 py-3 font-medium">
                      {r.subject_name}
                      {r.subject_area ? (
                        <p className="text-xs text-muted-foreground">{r.subject_area}</p>
                      ) : null}
                    </td>
                    {periodNames.map((name) => {
                      const v = r.grades[name];
                      return (
                        <td key={name} className="px-3 py-3 text-center">
                          {v === undefined || v === null ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            v.toFixed(1)
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3 text-center font-bold">
                      {r.average !== null ? r.average.toFixed(2) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {r.average !== null ? (
                        <StatusBadge tone={r.average >= 3 ? "success" : "warning"}>
                          {r.average >= 3 ? "Aprobada" : "En seguimiento"}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="neutral">Sin notas</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
