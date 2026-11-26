import { audienceLabel } from "@/features/resources/resource-card";
import { AlertTriangle, Check, FileText, History, Link2, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { StatusPill, Tag } from "@/components/ui-kit";
import { useChangeMaterialStatus, useDeleteMaterial, useMaterial } from "@/lib/platform/hooks";
import {
  MATERIAL_STATUS_HINT,
  MATERIAL_STATUS_LABEL,
  MATERIAL_STATUS_TONE,
  type MaterialStatus,
} from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/**
 * The side panel of a material.
 *
 * It shows the metadata, the state of the piece, the schools that can
 * see it and the history. The access is not changed from here: the
 * panel says which schools have it. The switch per school lives in
 * the sheet of the school (Colegios → Gestionar), where the piece is
 * listed with the rest of the catalog.
 */

export function MaterialPanel({
  materialId,
  onClose,
  className,
}: {
  materialId: string | null;
  onClose: () => void;
  className?: string;
}) {
  const material = useMaterial(materialId);
  const changeStatus = useChangeMaterialStatus();
  const removeMaterial = useDeleteMaterial();

  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // The panel is remounted when the material changes (the parent gives
  // it a key), so the messages of the previous material never leak into
  // the new one.
  const detail = material.data;
  const schools = detail?.schools ?? [];

  async function moveTo(status: MaterialStatus) {
    if (!detail) return;
    setProblem(null);
    try {
      await changeStatus.mutateAsync({ id: detail.id, status });
      setNotice(`El material quedó en ${MATERIAL_STATUS_LABEL[status].toLowerCase()}.`);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
    }
  }

  async function onDelete() {
    if (!detail) return;
    setProblem(null);
    try {
      await removeMaterial.mutateAsync(detail.id);
      onClose();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo eliminar el material.");
    }
  }

  const missing = detail?.missing ?? [];

  return (
    <Dialog open={Boolean(materialId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showClose={false}
        className={cn(
          // The panel is a drawer on the right, not a centered dialog:
          // the list stays visible behind it.
          "fixed right-0 top-0 left-auto flex h-dvh max-h-none w-full max-w-lg translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-border bg-card p-0 shadow-lift sm:rounded-none",
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">
              {detail?.title ?? (material.isLoading ? "Cargando…" : "Material")}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {detail ? `${detail.code} · ${detail.size_label}` : "Los metadatos del material."}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar el panel"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" strokeWidth={1.9} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {problem && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive"
            >
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              {problem}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-xs text-success"
            >
              <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
              {notice}
            </p>
          )}

          {detail && (
            <>
              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  Metadatos
                </h3>
                <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd>{detail.type}</dd>
                  <dt className="text-muted-foreground">Área</dt>
                  <dd>{detail.area}</dd>
                  <dt className="text-muted-foreground">Grados</dt>
                  <dd>
                    {detail.grades.length > 0 ? detail.grades.join(" · ") : "Todo el colegio"}
                  </dd>
                  <dt className="text-muted-foreground">Visible para</dt>
                  <dd>{audienceLabel(detail.visible_to)}</dd>
                  <dt className="text-muted-foreground">Origen</dt>
                  <dd className="flex items-center gap-1.5">
                    {detail.origin === "upload" ? (
                      <FileText className="size-3.5" strokeWidth={1.9} aria-hidden />
                    ) : (
                      <Link2 className="size-3.5" strokeWidth={1.9} aria-hidden />
                    )}
                    {detail.origin === "upload" ? "Carga manual" : "Enlace externo"}
                  </dd>
                  {detail.description && (
                    <>
                      <dt className="text-muted-foreground">Descripción</dt>
                      <dd className="text-muted-foreground">{detail.description}</dd>
                    </>
                  )}
                </dl>
              </section>

              {missing.length > 0 && (
                <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
                  Para publicar todavía falta: {missing.join(", ")}.
                </p>
              )}

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  Estado del material
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill
                    label={MATERIAL_STATUS_LABEL[detail.status]}
                    tone={MATERIAL_STATUS_TONE[detail.status]}
                  />
                  <span className="text-sm text-muted-foreground">
                    {MATERIAL_STATUS_HINT[detail.status]}
                  </span>
                </div>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  Colegios con acceso
                </h3>
                {schools.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este material todavía no tiene colegio con acceso.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-1.5">
                    {schools.map((school) => (
                      <li key={school.id}>
                        <Tag>{school.name}</Tag>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  El acceso se modifica en Colegios → Gestionar: allí está el interruptor de cada
                  pieza.
                </p>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  <History className="size-3.5" strokeWidth={1.9} aria-hidden />
                  Historial
                </h3>
                <ul className="flex flex-col divide-y divide-border">
                  {detail.history.map((entry) => (
                    <li key={entry.id} className="py-2.5">
                      <p className="text-sm">{entry.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.actor_name ?? "Sistema"} ·{" "}
                        {new Date(entry.created_at).toLocaleString("es-CO", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </li>
                  ))}
                  {detail.history.length === 0 && (
                    <li className="py-2.5 text-sm text-muted-foreground">Sin movimientos.</li>
                  )}
                </ul>
              </section>
            </>
          )}
        </div>

        {detail && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-4">
            {detail.available_transitions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => void moveTo(status as MaterialStatus)}
                disabled={changeStatus.isPending}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {MATERIAL_STATUS_LABEL[status as MaterialStatus]}
              </button>
            ))}
            {detail.status === "draft" && (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={removeMaterial.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive-soft disabled:opacity-60"
              >
                <Trash2 className="size-3.5" strokeWidth={1.9} aria-hidden />
                Eliminar
              </button>
            )}
            <span className="ml-auto">
              <Tag>{detail.schools.length} colegio(s)</Tag>
            </span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
