import { useRouteContext, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Link2, Plus, Trash2, Video } from "lucide-react";
import { PageHeader, SectionCard, EmptyHint } from "@/components/ui-kit";
import { ConfirmDialog, useDeleteConfirmation } from "@/components/confirm-dialog";
import { StatusBadge } from "@/components/status-badge";
import {
  useContentItems,
  useCreateContentItem,
  useDeleteContentItem,
  useCreateTask,
  useTasks,
  useDeleteTask,
  type ContentItem,
} from "@/lib/storage/hooks";
import { useAcademicPeriods } from "@/features/academics/hooks";
import {
  useMyCourseSubjects,
  type MyCourseSubject,
} from "@/features/teacher/use-my-course-subjects";
import { useCourseRoster } from "@/features/teacher/use-course-roster";
import { GradeGrid } from "@/features/teacher/grade-grid";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/docente/materia")({
  head: () => ({
    meta: [
      { title: "Materia — Lumen" },
      {
        name: "description",
        content: "Contenido, tareas, evaluaciones, estudiantes y calificaciones de la materia.",
      },
      { property: "og:title", content: "Materia — Lumen" },
      {
        property: "og:description",
        content: "Panel completo de la materia para el docente.",
      },
    ],
  }),
  component: Materia,
});

const tabs = ["Contenido", "Tareas", "Estudiantes", "Calificaciones"] as const;
type Tab = (typeof tabs)[number];

const contentIcons: Record<ContentItem["kind"], typeof FileText> = {
  document: FileText,
  video: Video,
  link: Link2,
  text: FileText,
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
}

function Materia() {
  const { session } = useRouteContext({ from: "/docente/materia" });
  const schoolId = session.primarySchoolId;
  const teacherId = session.user.id;

  const myCourseSubjects = useMyCourseSubjects(schoolId, teacherId);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Contenido");

  const effectiveId =
    pickedId && myCourseSubjects.items.some((cs) => cs.id === pickedId)
      ? pickedId
      : (myCourseSubjects.items[0]?.id ?? "");
  const selected = myCourseSubjects.items.find((cs) => cs.id === effectiveId) ?? null;

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

  return (
    <>
      <PageHeader
        title={selected ? selected.subject_name : "Materia"}
        subtitle={selected ? selected.course_name : "Seleccioná una materia"}
        actions={
          <select
            aria-label="Materia"
            disabled={myCourseSubjects.items.length === 0}
            value={effectiveId}
            onChange={(e) => setPickedId(e.target.value)}
            className="rounded-lg border border-input bg-card px-3 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {myCourseSubjects.items.length === 0 && <option value="">Sin materias</option>}
            {myCourseSubjects.items.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.subject_name} · {cs.course_name}
              </option>
            ))}
          </select>
        }
      />

      {myCourseSubjects.isLoading ? (
        <SectionCard>
          <p className="text-sm text-muted-foreground">Cargando tus materias...</p>
        </SectionCard>
      ) : myCourseSubjects.items.length === 0 ? (
        <SectionCard>
          <EmptyHint>
            Todavía no tenés materias asignadas. El administrador del colegio te asigna a un curso y
            materia desde la vista de asignaciones.
          </EmptyHint>
        </SectionCard>
      ) : !selected ? null : (
        <>
          <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Contenido" && <ContenidoTab schoolId={schoolId} courseSubject={selected} />}
          {tab === "Tareas" && <TareasTab schoolId={schoolId} courseSubject={selected} />}
          {tab === "Estudiantes" && <EstudiantesTab schoolId={schoolId} courseSubject={selected} />}
          {tab === "Calificaciones" && (
            <CalificacionesTab schoolId={schoolId} courseSubject={selected} />
          )}
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Contenido
// ---------------------------------------------------------------------------

function ContenidoTab({
  schoolId,
  courseSubject,
}: {
  schoolId: string;
  courseSubject: MyCourseSubject;
}) {
  const items = useContentItems(schoolId, courseSubject.id);
  const createItem = useCreateContentItem(schoolId);
  const deleteItem = useDeleteContentItem(schoolId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  // Only the kinds that need no file upload are offered here. Documents
  // and videos require a stored file (Supabase Storage), which is a
  // separate upload flow; offering them would produce a 422 from the
  // backend's content validation.
  const [kind, setKind] = useState<Extract<ContentItem["kind"], "link" | "text">>("link");
  const [url, setUrl] = useState("");

  // The deletion asks for confirmation with the shared modal.
  const itemToDelete = useDeleteConfirmation();

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    if (kind === "link" && !url.trim()) return;
    await createItem.mutateAsync({
      course_subject_id: courseSubject.id,
      title: title.trim(),
      kind,
      external_url: kind === "link" ? url.trim() : null,
    });
    setTitle("");
    setUrl("");
    setKind("link");
    setOpen(false);
  }

  return (
    <SectionCard
      title="Material de la materia"
      actions={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> Nuevo contenido
        </button>
      }
      bodyClassName="p-0"
    >
      {open && (
        <form onSubmit={create} className="space-y-3 border-b border-border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              aria-label="Título del contenido"
              placeholder="Título del material"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              aria-label="Tipo de contenido"
              value={kind}
              onChange={(e) => setKind(e.target.value as "link" | "text")}
              className="rounded-lg border border-input bg-card px-3 py-2 text-sm"
            >
              <option value="link">Enlace</option>
              <option value="text">Texto</option>
            </select>
          </div>
          {kind === "link" && (
            <input
              aria-label="URL del enlace"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Documentos y videos se suben desde el almacenamiento del colegio (próximamente). Por
            ahora podés publicar enlaces y notas de texto.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={createItem.isPending || !title.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {createItem.isPending ? "Guardando..." : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
          {createItem.error && (
            <p role="alert" className="text-sm text-destructive">
              {createItem.error.message}
            </p>
          )}
        </form>
      )}

      {items.isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Cargando contenido...</p>
      ) : items.error ? (
        <p role="alert" className="px-5 py-6 text-sm text-destructive">
          {items.error.message}
        </p>
      ) : (items.data?.length ?? 0) === 0 ? (
        <div className="p-5">
          <EmptyHint>
            Aún no hay material publicado. Usá "Nuevo contenido" para crear el primero.
          </EmptyHint>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.data?.map((c) => {
            const Icon = contentIcons[c.kind];
            return (
              <li
                key={c.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3.5"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.75} />
                  <span className="truncate text-sm font-medium">{c.title}</span>
                </span>
                <div className="flex items-center gap-2">
                  <StatusBadge tone="info">{c.kind}</StatusBadge>
                  <button
                    type="button"
                    onClick={() =>
                      itemToDelete.ask({
                        id: c.id,
                        title: `el contenido "${c.title}"`,
                        description: "El material deja de estar disponible para los estudiantes.",
                      })
                    }
                    disabled={deleteItem.isPending}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-60"
                    aria-label={`Eliminar ${c.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={itemToDelete.target !== null}
        title={`Eliminar ${itemToDelete.target?.title ?? ""}`}
        description={itemToDelete.target?.description}
        pending={deleteItem.isPending}
        onCancel={itemToDelete.close}
        onConfirm={() => {
          const id = itemToDelete.target?.id;
          if (!id) return;
          deleteItem.mutate(id, { onSuccess: itemToDelete.close });
        }}
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------------

function TareasTab({
  schoolId,
  courseSubject,
}: {
  schoolId: string;
  courseSubject: MyCourseSubject;
}) {
  const tasks = useTasks(schoolId, courseSubject.id);
  const createTask = useCreateTask(schoolId);
  const deleteTask = useDeleteTask(schoolId);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [maxScore, setMaxScore] = useState("");

  // The deletion asks for confirmation with the shared modal.
  const taskToDelete = useDeleteConfirmation();

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    await createTask.mutateAsync({
      course_subject_id: courseSubject.id,
      title: title.trim(),
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      max_score: maxScore ? Number(maxScore) : null,
    });
    setTitle("");
    setDueAt("");
    setMaxScore("");
    setOpen(false);
  }

  return (
    <SectionCard
      title="Tareas asignadas"
      actions={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-4" /> Nueva tarea
        </button>
      }
      bodyClassName="p-0"
    >
      {open && (
        <form onSubmit={create} className="space-y-3 border-b border-border bg-muted/30 p-4">
          <input
            aria-label="Título de la tarea"
            placeholder="Título de la tarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vencimiento
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Puntaje máximo
              <input
                type="number"
                min={0}
                step="0.1"
                value={maxScore}
                onChange={(e) => setMaxScore(e.target.value)}
                placeholder="5"
                className="mt-1 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={createTask.isPending || !title.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {createTask.isPending ? "Guardando..." : "Crear tarea"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
          {createTask.error && (
            <p role="alert" className="text-sm text-destructive">
              {createTask.error.message}
            </p>
          )}
        </form>
      )}

      {tasks.isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Cargando tareas...</p>
      ) : tasks.error ? (
        <p role="alert" className="px-5 py-6 text-sm text-destructive">
          {tasks.error.message}
        </p>
      ) : (tasks.data?.length ?? 0) === 0 ? (
        <div className="p-5">
          <EmptyHint>
            No hay tareas en esta materia. Usá "Nueva tarea" para crear la primera.
          </EmptyHint>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {tasks.data?.map((t) => {
            const overdue = t.due_at ? new Date(t.due_at) < new Date() : false;
            return (
              <li
                key={t.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    Vence: {formatDate(t.due_at)}
                    {t.max_score ? ` · Máx: ${t.max_score}` : ""} · {t.pending_submissions} por
                    revisar
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={overdue ? "danger" : "warning"}>
                    {overdue ? "Vencida" : "Activa"}
                  </StatusBadge>
                  <button
                    type="button"
                    onClick={() =>
                      taskToDelete.ask({
                        id: t.id,
                        title: `la tarea "${t.title}"`,
                        description:
                          "Se borra la tarea y las entregas que los estudiantes ya hayan enviado.",
                      })
                    }
                    disabled={deleteTask.isPending}
                    className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:opacity-60"
                    aria-label={`Eliminar ${t.title}`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog
        open={taskToDelete.target !== null}
        title={`Eliminar ${taskToDelete.target?.title ?? ""}`}
        description={taskToDelete.target?.description}
        pending={deleteTask.isPending}
        onCancel={taskToDelete.close}
        onConfirm={() => {
          const id = taskToDelete.target?.id;
          if (!id) return;
          deleteTask.mutate(id, { onSuccess: taskToDelete.close });
        }}
      />
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Estudiantes
// ---------------------------------------------------------------------------

function EstudiantesTab({
  schoolId,
  courseSubject,
}: {
  schoolId: string;
  courseSubject: MyCourseSubject;
}) {
  const roster = useCourseRoster(schoolId, courseSubject.course_id);

  return (
    <SectionCard title={`Estudiantes de ${courseSubject.course_name}`} bodyClassName="p-0">
      {roster.isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Cargando estudiantes...</p>
      ) : roster.isError ? (
        <p role="alert" className="px-5 py-6 text-sm text-destructive">
          {roster.error?.message ?? "No se pudieron cargar los estudiantes."}
        </p>
      ) : roster.students.length === 0 ? (
        <div className="p-5">
          <EmptyHint>No hay estudiantes activos inscriptos en este curso todavía.</EmptyHint>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {roster.students.map((s) => (
            <li key={s.studentId} className="flex items-center gap-3 px-5 py-3.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
                {s.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.name}</p>
                {s.email && <p className="truncate text-xs text-muted-foreground">{s.email}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Calificaciones
// ---------------------------------------------------------------------------

function CalificacionesTab({
  schoolId,
  courseSubject,
}: {
  schoolId: string;
  courseSubject: MyCourseSubject;
}) {
  const periods = useAcademicPeriods(schoolId);
  const [pickedPeriodId, setPickedPeriodId] = useState<string | null>(null);

  const defaultPeriodId = (periods.data?.find((p) => p.is_current) ?? periods.data?.[0])?.id ?? "";
  const periodId =
    pickedPeriodId && (periods.data ?? []).some((p) => p.id === pickedPeriodId)
      ? pickedPeriodId
      : defaultPeriodId;

  return (
    <SectionCard
      title="Grilla de calificaciones"
      actions={
        <select
          aria-label="Período"
          disabled={periods.isLoading || (periods.data?.length ?? 0) === 0}
          value={periodId}
          onChange={(e) => setPickedPeriodId(e.target.value)}
          className="rounded-lg border border-input bg-card px-3 py-2 text-sm disabled:opacity-60"
        >
          {(periods.data?.length ?? 0) === 0 && <option value="">Sin períodos</option>}
          {periods.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_current ? " (actual)" : ""}
            </option>
          ))}
        </select>
      }
      bodyClassName="p-0"
    >
      {periods.isLoading ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Cargando períodos...</p>
      ) : !periodId ? (
        <div className="p-5">
          <EmptyHint>
            No hay períodos académicos definidos. El administrador los crea desde la vista de
            períodos.
          </EmptyHint>
        </div>
      ) : (
        <GradeGrid
          schoolId={schoolId}
          courseSubjectId={courseSubject.id}
          courseId={courseSubject.course_id}
          courseName={courseSubject.course_name}
          periodId={periodId}
        />
      )}
    </SectionCard>
  );
}
