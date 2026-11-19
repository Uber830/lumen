import { createFileRoute, Link, useRouteContext } from "@tanstack/react-router";
import { BookOpen, ClipboardList, Plus, Users } from "lucide-react";
import { PageHeader, SectionCard, StatCard, EmptyHint } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { useMyCourseSubjects } from "@/features/teacher/use-my-course-subjects";
import { useTasks } from "@/lib/storage/hooks";

export const Route = createFileRoute("/docente/")({
  head: () => ({
    meta: [
      { title: "Mis materias — Lumen" },
      {
        name: "description",
        content: "Materias a cargo, entregas por revisar y próximas evaluaciones del docente.",
      },
      { property: "og:title", content: "Mis materias — Lumen" },
      {
        property: "og:description",
        content: "Gestioná contenidos, tareas y calificaciones de tus materias.",
      },
    ],
  }),
  component: TeacherDashboard,
});

function TeacherDashboard() {
  const { session } = useRouteContext({ from: "/docente/" });
  const schoolId = session.primarySchoolId;
  const teacherId = session.user.id;

  const myCourseSubjects = useMyCourseSubjects(schoolId, teacherId);
  const tasks = useTasks(schoolId);

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

  const subjects = myCourseSubjects.items;
  const totalStudents = subjects.reduce((sum, s) => sum + s.enrolled_students, 0);
  const pendingReviews = (tasks.data ?? []).reduce((sum, t) => sum + t.pending_submissions, 0);
  const tasksDueToday = (tasks.data ?? []).filter((t) => isDueToday(t.due_at)).length;

  return (
    <>
      <PageHeader
        title="Mis materias"
        subtitle={session.profile?.full_name ?? "Docente"}
        actions={
          <Link
            to="/docente/calificaciones"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Cargar calificaciones
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Materias a cargo"
          value={String(subjects.length)}
          delta={`${totalStudents} estudiantes`}
          icon={BookOpen}
        />
        <StatCard
          label="Entregas por revisar"
          value={String(pendingReviews)}
          delta={tasksDueToday > 0 ? `${tasksDueToday} vence(n) hoy` : "Al día"}
          tone={pendingReviews > 0 ? "warning" : "success"}
          icon={ClipboardList}
        />
        <StatCard
          label="Tareas activas"
          value={String(tasks.data?.length ?? 0)}
          icon={ClipboardList}
        />
        <StatCard label="Estudiantes" value={String(totalStudents)} icon={Users} />
      </div>

      <SectionCard title="Cursos y materias">
        {myCourseSubjects.isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando tus materias...</p>
        ) : myCourseSubjects.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {myCourseSubjects.error?.message ?? "No se pudieron cargar tus materias."}
          </p>
        ) : subjects.length === 0 ? (
          <EmptyHint>
            Todavía no tenés materias asignadas. El administrador del colegio te asigna a un curso y
            materia desde la vista de asignaciones.
          </EmptyHint>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((s) => (
              <article key={s.id} className="rounded-xl border border-border p-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold">{s.subject_name}</h3>
                    <p className="text-xs text-muted-foreground">{s.course_name}</p>
                  </div>
                  {s.subject_area ? <StatusBadge tone="info">{s.subject_area}</StatusBadge> : null}
                </div>
                <p className="mt-4 text-sm text-muted-foreground">
                  {s.enrolled_students} estudiante{s.enrolled_students === 1 ? "" : "s"}
                </p>
                <Link
                  to="/docente/materia"
                  className="mt-4 block rounded-lg border border-border px-3 py-2 text-center text-sm font-semibold hover:bg-muted"
                >
                  Abrir materia
                </Link>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

/** True when a due date (ISO string) falls on today's calendar day. */
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
