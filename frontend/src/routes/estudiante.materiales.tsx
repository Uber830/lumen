import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import {
  CheckCircle2,
  Circle,
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Video,
} from "lucide-react";

import { PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import {
  useMarkContentCompleted,
  useMyContent,
  useMyContentProgress,
  useUnmarkContentCompleted,
} from "@/features/student/use-my-content";
import { BUCKETS, createSignedUrl } from "@/lib/storage/files";

export const Route = createFileRoute("/estudiante/materiales")({
  head: () => ({
    meta: [
      { title: "Materiales — Lumen" },
      {
        name: "description",
        content: "Material de tus materias y tu progreso de lectura.",
      },
      { property: "og:title", content: "Materiales — Lumen" },
      {
        property: "og:description",
        content: "Clases, lecturas y recursos de tus docentes.",
      },
    ],
  }),
  component: Materiales,
});

const KIND_META = {
  document: { label: "Documento", icon: FileText },
  video: { label: "Video", icon: Video },
  link: { label: "Enlace", icon: Link2 },
  text: { label: "Texto", icon: FileText },
} as const;

function Materiales() {
  const { session } = useRouteContext({ from: "/estudiante/materiales" });
  const schoolId = session.primarySchoolId;

  const content = useMyContent(schoolId);
  const progress = useMyContentProgress(schoolId);
  const mark = useMarkContentCompleted(schoolId ?? "");
  const unmark = useUnmarkContentCompleted(schoolId ?? "");

  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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

  const items = content.data ?? [];
  const completedIds = new Set((progress.data ?? []).map((row) => row.content_item_id));
  const completedCount = items.filter((item) => completedIds.has(item.id)).length;

  async function openStoredFile(itemId: string, path: string) {
    setDownloadingId(itemId);
    setDownloadError(null);
    try {
      const url = await createSignedUrl(BUCKETS.classContent, path, 120);
      window.open(url, "_blank", "noopener");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "No se pudo abrir el archivo.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Materiales" subtitle="El contenido de tus materias" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Materiales" value={String(items.length)} tone="primary" />
        <StatCard
          label="Completados"
          value={String(completedCount)}
          delta={`de ${items.length} disponibles`}
          tone="success"
        />
        <StatCard
          label="Pendientes"
          value={String(items.length - completedCount)}
          delta="Marcá los que ya leíste"
          tone={items.length - completedCount > 0 ? "warning" : "success"}
        />
      </div>

      {downloadError ? (
        <p role="alert" className="text-sm text-destructive">
          {downloadError}
        </p>
      ) : null}

      <SectionCard title="Material disponible" bodyClassName="p-0">
        {content.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando materiales...</p>
        ) : content.error ? (
          <p role="alert" className="px-5 py-6 text-sm text-destructive">
            {content.error.message}
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Todavia no hay materiales publicados en tus materias.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => {
              const meta = KIND_META[item.kind] ?? KIND_META.text;
              const Icon = meta.icon;
              const completed = completedIds.has(item.id);
              return (
                <li key={item.id} className="px-5 py-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <StatusBadge tone="info">
                          <Icon className="size-3" /> {meta.label}
                        </StatusBadge>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {item.subject_name}
                        {item.course_name ? ` · ${item.course_name}` : ""}
                      </p>
                      {item.description ? (
                        <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                      ) : null}
                      {item.kind === "text" && item.body ? (
                        <p className="mt-2 whitespace-pre-line rounded-lg border border-border bg-muted/40 p-3 text-sm">
                          {item.body}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {item.external_url ? (
                        <a
                          href={item.external_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted"
                        >
                          <ExternalLink className="size-3.5" /> Abrir
                        </a>
                      ) : item.storage_path ? (
                        <button
                          type="button"
                          onClick={() => void openStoredFile(item.id, item.storage_path as string)}
                          disabled={downloadingId === item.id}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                        >
                          {downloadingId === item.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          Descargar
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => (completed ? unmark.mutate(item.id) : mark.mutate(item.id))}
                        disabled={mark.isPending || unmark.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-primary hover:bg-primary-soft disabled:opacity-60"
                      >
                        {completed ? (
                          <>
                            <CheckCircle2 className="size-3.5" /> Completado
                          </>
                        ) : (
                          <>
                            <Circle className="size-3.5" /> Marcar como leído
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {mark.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {mark.error.message}
        </p>
      ) : null}
      {unmark.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {unmark.error.message}
        </p>
      ) : null}
    </>
  );
}
