import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, FileText, Loader2, Paperclip, Send, Upload, X } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge, toneForEstado } from "@/components/status-badge";
import { useMySubmissions, useSaveSubmission } from "@/features/student/use-my-submissions";
import { useTasks, type Task } from "@/lib/storage/hooks";
import { BUCKETS, createSignedUrl, uploadTaskSubmission } from "@/lib/storage/files";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estudiante/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas — Lumen" },
      {
        name: "description",
        content: "Subí tus entregas arrastrando archivos y seguí el estado de cada tarea.",
      },
      { property: "og:title", content: "Tareas — Lumen" },
      {
        property: "og:description",
        content: "Entregas de tareas simples y ordenadas.",
      },
    ],
  }),
  component: Tareas,
});

/** The size limit of the bucket, in bytes. */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleDateString("es-CO");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Tareas() {
  const { session } = useRouteContext({ from: "/estudiante/tareas" });
  const schoolId = session.primarySchoolId;
  const studentId = session.user.id;

  const tasks = useTasks(schoolId);
  const submissions = useMySubmissions(schoolId);
  const save = useSaveSubmission(schoolId ?? "");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePath, setFilePath] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

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

  const submissionByTaskId = new Map(
    (submissions.data ?? []).map((submission) => [submission.task_id, submission]),
  );
  const selected = (tasks.data ?? []).find((task) => task.id === selectedId) ?? null;
  const submission = selected ? (submissionByTaskId.get(selected.id) ?? null) : null;

  function selectTask(task: Task) {
    const current = submissionByTaskId.get(task.id) ?? null;
    setSelectedId(task.id);
    setBody(current?.body ?? "");
    setFile(null);
    setFilePath(current?.file_path ?? null);
    setUploadError(null);
  }

  async function pickFile(next: File | undefined) {
    if (!next || !selected) return;
    if (next.size > MAX_FILE_SIZE) {
      setUploadError("El archivo supera el límite de 50 MB.");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const uploaded = await uploadTaskSubmission({
        schoolId: schoolId as string,
        taskId: selected.id,
        studentId: studentId as string,
        file: next,
      });
      setFile(next);
      setFilePath(uploaded.path);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!selected) return;
    try {
      await save.mutateAsync({
        taskId: selected.id,
        submissionId: submission?.id ?? null,
        body: body.trim() || null,
        filePath,
      });
      setFile(null);
    } catch {
      // The error is rendered from the mutation state below.
    }
  }

  async function download(path: string) {
    setDownloading(true);
    try {
      const url = await createSignedUrl(BUCKETS.taskSubmissions, path, 120);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <PageHeader title="Tareas" subtitle={`${tasks.data?.length ?? 0} tareas asignadas`} />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <SectionCard title="Mis tareas" bodyClassName="p-0">
          {tasks.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Cargando tareas...</p>
          ) : tasks.error ? (
            <p role="alert" className="px-5 py-6 text-sm text-destructive">
              {tasks.error.message}
            </p>
          ) : !tasks.data || tasks.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No hay tareas asignadas todavia.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.data.map((task) => {
                const current = submissionByTaskId.get(task.id);
                return (
                  <li
                    key={task.id}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_auto] cursor-pointer items-center gap-3 px-5 py-4 hover:bg-muted/40",
                      selected?.id === task.id && "bg-primary-soft",
                    )}
                    onClick={() => selectTask(task)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{task.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {task.course_subject_label} · Vence: {formatDate(task.due_at)}
                      </p>
                    </div>
                    <StatusBadge tone={toneForEstado(current?.status ?? "draft")}>
                      {current?.status ?? "draft"}
                    </StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title={selected ? `Entrega: ${selected.title}` : "Selecciona una tarea"}
          description={
            selected
              ? `Vence: ${formatDate(selected.due_at)}`
              : "Toca una tarea de la izquierda para ver detalles y entregar."
          }
        >
          {selected ? (
            <div className="space-y-4">
              {selected.description ? (
                <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {selected.description}
                </p>
              ) : null}

              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  void pickFile(event.dataTransfer.files[0]);
                }}
                className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40 px-4 py-8 text-center"
              >
                <Upload className="size-7 text-muted-foreground" strokeWidth={1.75} />
                <p className="mt-3 text-sm font-semibold">Arrastrá tu archivo acá</p>
                <p className="text-xs text-muted-foreground">PDF, DOCX o imagenes · hasta 50 MB</p>
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    void pickFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="mt-4 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Subiendo...
                    </span>
                  ) : (
                    "Elegir archivo"
                  )}
                </button>
              </div>

              {uploadError ? (
                <p role="alert" className="text-sm text-destructive">
                  {uploadError}
                </p>
              ) : null}

              {file || filePath ? (
                <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                  <Paperclip className="size-4 shrink-0 text-muted-foreground" />
                  <p className="min-w-0 flex-1 truncate text-sm">
                    {file ? `${file.name} (${formatSize(file.size)})` : filePath}
                  </p>
                  {file ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFilePath(null);
                      }}
                      aria-label="Quitar archivo"
                      className="grid size-8 place-items-center rounded-lg hover:bg-muted"
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ) : null}

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Comentario (opcional)
                </span>
                <textarea
                  rows={3}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>

              <button
                type="button"
                onClick={() => void submit()}
                disabled={save.isPending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {save.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                {submission ? "Actualizar entrega" : "Enviar entrega"}
              </button>

              {save.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {save.error.message}
                </p>
              ) : null}

              {submission ? (
                <div className="rounded-lg border border-border p-3 text-xs">
                  <p className="font-semibold">Entrega actual</p>
                  <p className="text-muted-foreground">Estado: {submission.status}</p>
                  {submission.grade ? (
                    <p className="text-muted-foreground">Nota: {Number(submission.grade)}</p>
                  ) : null}
                  {submission.feedback ? (
                    <p className="mt-1 text-foreground">{submission.feedback}</p>
                  ) : null}
                  {submission.file_path ? (
                    <button
                      type="button"
                      onClick={() => void download(submission.file_path as string)}
                      disabled={downloading}
                      className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                    >
                      {downloading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Download className="size-3.5" />
                      )}
                      Descargar el archivo que entregaste
                    </button>
                  ) : null}
                </div>
              ) : (
                <p className="flex items-start gap-2 text-xs text-muted-foreground">
                  <FileText className="mt-0.5 size-3.5 shrink-0" />
                  Todavia no entregaste esta tarea.
                </p>
              )}
            </div>
          ) : null}
        </SectionCard>
      </div>
    </>
  );
}
