import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { AlertTriangle, BookOpen, ClipboardList, GraduationCap, Users } from "lucide-react";
import { PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { useSchoolStats } from "@/lib/admin/hooks";
import { useSchoolMembers } from "@/features/academics/hooks";

export const Route = createFileRoute("/admin/")({
  head: () => ({
    meta: [
      { title: "Panel del colegio — Lumen" },
      {
        name: "description",
        content: "Resumen académico del colegio: estudiantes, docentes, cursos y alertas.",
      },
      { property: "og:title", content: "Panel del colegio — Lumen" },
      {
        property: "og:description",
        content: "Métricas y accesos rápidos para la administración del colegio.",
      },
    ],
  }),
  component: AdminDashboard,
});

const quickActions = [
  { to: "/admin/docentes", label: "Docentes", icon: Users },
  { to: "/admin/estudiantes", label: "Estudiantes", icon: GraduationCap },
  { to: "/admin/cursos", label: "Nuevo curso", icon: BookOpen },
  { to: "/admin/asignaciones", label: "Asignar", icon: ClipboardList },
];

function formatNumber(n: number): string {
  return n.toLocaleString("es-CO");
}

function AdminDashboard() {
  const { session } = useRouteContext({ from: "/admin/" });
  const schoolId = session.primarySchoolId;
  const stats = useSchoolStats(schoolId);
  const recentStudents = useSchoolMembers(schoolId, "student");
  const unassignedTeachers = useSchoolMembers(schoolId, "teacher");

  const recentStudentsList = (recentStudents.data ?? []).slice(0, 5);
  const teachersWithoutSubjects = (unassignedTeachers.data ?? []).filter(
    (t) => t.is_primary === false,
  );

  return (
    <>
      <PageHeader
        title={stats.data?.schoolName || "Panel del colegio"}
        subtitle={dashboardSubtitle(stats.data)}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Estudiantes"
          value={formatNumber(stats.data?.students ?? 0)}
          delta={stats.data ? "Matriculados activos" : "Cargando..."}
          icon={GraduationCap}
        />
        <StatCard
          label="Docentes"
          value={formatNumber(stats.data?.teachers ?? 0)}
          delta={stats.data ? "En el colegio" : "Cargando..."}
          icon={Users}
        />
        <StatCard
          label="Cursos activos"
          value={formatNumber(stats.data?.courses ?? 0)}
          delta="Registrados"
          icon={BookOpen}
          tone="success"
        />
        <StatCard
          label="Tareas sin revisar"
          value={formatNumber(stats.data?.pendingTasks ?? 0)}
          delta={stats.data?.pendingTasks ? "Requiere atencion" : "Al dia"}
          icon={AlertTriangle}
          tone={stats.data?.pendingTasks ? "warning" : "primary"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Acciones rapidas"
          description="Atajos para alta y gestion"
          className="lg:col-span-2"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quickActions.map((q) => (
              <Link
                key={q.to}
                to={q.to}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs font-semibold hover:bg-muted"
              >
                <q.icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
                <span className="truncate">{q.label}</span>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Alertas" description="Puntos que requieren seguimiento">
          <ul className="space-y-3">
            {stats.data && stats.data.pendingTasks > 0 && (
              <li className="flex items-start gap-3 rounded-lg border border-border p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} />
                <span className="text-sm">
                  {stats.data.pendingTasks} tareas pendientes de revision
                </span>
              </li>
            )}
            {teachersWithoutSubjects.length > 0 && (
              <li className="flex items-start gap-3 rounded-lg border border-border p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" strokeWidth={2} />
                <span className="text-sm">
                  {teachersWithoutSubjects.length} docentes sin materias asignadas
                </span>
              </li>
            )}
            {stats.data &&
              stats.data.pendingTasks === 0 &&
              teachersWithoutSubjects.length === 0 && (
                <li className="flex items-start gap-3 rounded-lg border border-success bg-success-soft p-3">
                  <StatusBadge tone="success">Al dia</StatusBadge>
                  <span className="text-sm">Sin alertas pendientes.</span>
                </li>
              )}
          </ul>
        </SectionCard>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard
          title="Estudiantes recientes"
          description="Ultimos matriculados"
          className="lg:col-span-2"
          bodyClassName="p-0"
          actions={
            <Link
              to="/admin/estudiantes"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Ver todos
            </Link>
          }
        >
          {recentStudentsList.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Aun no hay estudiantes matriculados. Invita el primero desde la pagina de estudiantes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head-band text-left text-[11px] uppercase tracking-[0.09em]">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Estudiante</th>
                    <th className="px-5 py-3 font-semibold">Ingreso</th>
                    <th className="px-5 py-3 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudentsList.map((s) => (
                    <tr key={s.user_id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <p className="font-medium">{s.full_name}</p>
                        <p className="text-xs text-muted-foreground">{s.email ?? "Sin correo"}</p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {new Date(s.joined_at).toLocaleDateString("es-CO")}
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge tone={s.is_primary ? "success" : "neutral"}>
                          {s.is_primary ? "Activo" : "Secundario"}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Estado del colegio"
          description="Resumen del colegio y el periodo"
          className="lg:col-span-1"
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Codigo</dt>
              <dd className="font-mono text-base">{stats.data?.schoolShortCode || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Estado</dt>
              <dd>
                <StatusBadge tone={stats.data?.schoolStatus === "active" ? "success" : "warning"}>
                  {stats.data?.schoolStatus === "active"
                    ? "Activo"
                    : stats.data?.schoolStatus === "trial"
                      ? "Prueba"
                      : "Suspendido"}
                </StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Periodo actual
              </dt>
              <dd>
                {stats.data?.currentPeriod ? (
                  <span className="font-medium">{stats.data.currentPeriod.name}</span>
                ) : (
                  <span className="text-muted-foreground">Sin periodo activo</span>
                )}
              </dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </>
  );
}

function dashboardSubtitle(data: ReturnType<typeof useSchoolStats>["data"] | undefined): string {
  if (!data) return "Cargando metricas...";
  if (!data.currentPeriod) return `Estado: ${data.schoolStatus}`;
  return `Periodo activo: ${data.currentPeriod.name} · Estado: ${data.schoolStatus}`;
}
