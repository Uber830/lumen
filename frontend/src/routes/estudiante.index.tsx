import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { useMemo } from "react";
import { BookOpen, Clock, FileCheck2, GraduationCap, Upload } from "lucide-react";
import { PageHeader, SectionCard, StatCard, EmptyHint } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { useMySubjects } from "@/features/student/use-my-subjects";
import { useMySubmissions } from "@/features/student/use-my-submissions";
import { useStudentGrades } from "@/lib/grades/student";
import { useTasks } from "@/lib/storage/hooks";

export const Route = createFileRoute("/estudiante/")({
  head: () => ({
    meta: [
      { title: "Mis clases — Lumen" },
      {
        name: "description",
        content: "Clases, progreso, tareas pendientes y evaluaciones del estudiante.",
      },
      { property: "og:title", content: "Mis clases — Lumen" },
      {
        property: "og:description",
        content: "Seguí tu progreso por materia y tus entregas pendientes.",
      },
    ],
  }),
  component: StudentDashboard,
});

/** The first name, for a friendly greeting. */
function firstName(fullName: string | null | undefined): string {
  if (!fullName) return "";
  return fullName.trim().split(/\s+/)[0] ?? "";
}

function StudentDashboard() {
  const { session } = useRouteContext({ from: "/estudiante/" });
  const schoolId = session.primarySchoolId;
  const studentId = session.user.id;

  const subjects = useMySubjects(schoolId, studentId);
  const tasks = useTasks(schoolId);
  const submissions = useMySubmissions(schoolId);
  const grades = useStudentGrades(schoolId, studentId);

  // Tasks still open: due in the future or with no due date, and not
  // handed in yet.
  const pendingTasks = useMemo(() => {
    const delivered = new Set(
      (submissions.data ?? [])
        .filter((submission) => submission.status !== "draft")
        .map((submission) => submission.task_id),
    );
    return (tasks.data ?? []).filter(
      (task) => !delivered.has(task.id) && (!task.due_at || new Date(task.due_at) >= new Date()),
    );
  }, [tasks.data, submissions.data]);
  const dueTodayCount = useMemo(
    () => (tasks.data ?? []).filter((t) => isDueToday(t.due_at)).length,
    [tasks.data],
  );

  const overallAverage = useMemo(() => {
    const rows = grades.data?.rows ?? [];
    const avgs = rows.map((r) => r.average).filter((n): n is number => n !== null);
    if (avgs.length === 0) return null;
    return avgs.reduce((acc, n) => acc + n, 0) / avgs.length;
  }, [grades.data]);

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

  const greeting = firstName(session.profile?.full_name);

  return (
    <>
      <PageHeader
        title={greeting ? `Hola, ${greeting}` : "Mis clases"}
        subtitle="Tu progreso académico"
        actions={
          <Link
            to="/estudiante/tareas"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Upload className="size-4" /> Entregar tarea
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Materias" value={String(subjects.items.length)} icon={BookOpen} />
        <StatCard
          label="Tareas pendientes"
          value={String(pendingTasks.length)}
          delta={dueTodayCount > 0 ? `${dueTodayCount} vence(n) hoy` : "Ninguna vence hoy"}
          icon={Clock}
          tone={pendingTasks.length > 0 ? "warning" : "success"}
        />
        <StatCard
          label="Tareas asignadas"
          value={String(tasks.data?.length ?? 0)}
          icon={FileCheck2}
        />
        <StatCard
          label="Promedio general"
          value={overallAverage !== null ? overallAverage.toFixed(2) : "—"}
          delta={overallAverage !== null ? "Sobre 5.00" : "Sin notas aún"}
          icon={GraduationCap}
          tone={overallAverage !== null && overallAverage >= 3 ? "success" : "warning"}
        />
      </div>

      <SectionCard title="Mis materias" bodyClassName="p-5">
        {subjects.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando tus materias...</p>
        ) : subjects.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {subjects.error?.message ?? "No se pudieron cargar tus materias."}
          </p>
        ) : subjects.items.length === 0 ? (
          <EmptyHint>
            Todavía no estás inscripto en ninguna materia. El colegio te inscribe en un curso y
            verás acá tus materias.
          </EmptyHint>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.items.map((s) => (
              <article
                key={s.id}
                className="rounded-lg border border-border p-5 transition-shadow hover:shadow-lift"
              >
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{s.subject_name}</h3>
                    <p className="truncate text-xs text-muted-foreground">{s.course_name}</p>
                  </div>
                  {s.subject_area ? <StatusBadge tone="info">{s.subject_area}</StatusBadge> : null}
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <Link
                    to="/estudiante/materiales"
                    className="rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold hover:bg-muted"
                  >
                    Ver materiales
                  </Link>
                  <Link
                    to="/estudiante/notas"
                    className="rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold hover:bg-muted"
                  >
                    Ver mis notas
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Tareas pendientes"
        description="Ordenadas por vencimiento"
        bodyClassName="p-0"
      >
        {tasks.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando tareas...</p>
        ) : tasks.error ? (
          <p role="alert" className="px-5 py-6 text-sm text-destructive">
            {tasks.error.message}
          </p>
        ) : pendingTasks.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No tenés tareas pendientes. 🎉</p>
        ) : (
          <ul className="divide-y divide-border">
            {[...pendingTasks]
              .sort((a, b) => dueSortValue(a.due_at) - dueSortValue(b.due_at))
              .map((t) => (
                <li
                  key={t.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.course_subject_label} · Vence: {formatDate(t.due_at)}
                    </p>
                  </div>
                  <StatusBadge tone={isDueToday(t.due_at) ? "warning" : "info"}>
                    {isDueToday(t.due_at) ? "Vence hoy" : "Pendiente"}
                  </StatusBadge>
                </li>
              ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "Sin fecha" : d.toLocaleDateString("es-CO");
}

/** Sort key for due dates: tasks with no date go last. */
function dueSortValue(dueAt: string | null): number {
  if (!dueAt) return Number.POSITIVE_INFINITY;
  const t = new Date(dueAt).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

function isDueToday(dueAt: string | null): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  return (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  );
}
