import { AlertTriangle, Check, FileText, History, Link2, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { StatusPill, Tag } from "@/components/ui-kit";
import { ApiError } from "@/lib/api/client";
import {
  useChangeMaterialStatus,
  useDeleteMaterial,
  useMaterial,
  useSetMaterialSchools,
} from "@/lib/platform/hooks";
import {
  MATERIAL_STATUS_LABEL,
  MATERIAL_STATUS_TONE,
  type MaterialStatus,
} from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/**
 * The side panel of a material.
 *
 * It shows the metadata, the schools that can see it and the history.
 * The access is a switch per school: the change is saved right away
 * and, when the server asks for a confirmation (a published material
 * that loses a school), the panel says which schools are affected
 * before sending the same request confirmed.
 */

/** The switch of the access. It is a button with the role of a switch. */
function AccessSwitch({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        checked ? "border-primary bg-primary" : "border-input bg-muted",
      )}
    >
      <span
        className={cn(
          "block size-3.5 rounded-full bg-background transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-[3px]",
        )}
        aria-hidden
      />
    </button>
  );
}

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
  const setSchools = useSetMaterialSchools();
  const changeStatus = useChangeMaterialStatus();
  const removeMaterial = useDeleteMaterial();

  // The schools whose access is about to be revoked, when the server
  // asked for a confirmation.
  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string }[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  // The panel is remounted when the material changes (the parent gives
  // it a key), so the messages of the previous material never leak into
  // the new one.
  const detail = material.data;
  const enabled = useMemo(
    () => new Set((detail?.schools ?? []).map((school) => school.id)),
    [detail],
  );

  async function toggleSchool(schoolId: string, name: string) {
    if (!detail) return;
    const next = new Set(enabled);
    if (next.has(schoolId)) next.delete(schoolId);
    else next.add(schoolId);

    setProblem(null);
    try {
      await setSchools.mutateAsync({ id: detail.id, school_ids: [...next] });
      setNotice(`${name}: ${next.has(schoolId) ? "con acceso" : "sin acceso"}.`);
    } catch (error) {
      // A published material that loses a school needs a confirmation:
      // the server says which schools are affected.
      if (error instanceof ApiError && error.status === 409) {
        const affected = (error.body as { affected?: { id: string; name: string }[] })?.affected;
        setPendingRemoval(affected ?? [{ id: schoolId, name }]);
        return;
      }
      setProblem(error instanceof Error ? error.message : "No se pudo guardar el cambio.");
    }
  }

  async function confirmRemoval() {
    if (!detail || !pendingRemoval) return;
    const next = new Set(enabled);
    for (const school of pendingRemoval) next.delete(school.id);
    setProblem(null);
    try {
      await setSchools.mutateAsync({
        id: detail.id,
        school_ids: [...next],
        confirm: true,
      });
      setNotice("El acceso se actualizó.");
      setPendingRemoval(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo guardar el cambio.");
    }
  }

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
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    <StatusPill
                      label={MATERIAL_STATUS_LABEL[detail.status]}
                      tone={MATERIAL_STATUS_TONE[detail.status]}
                    />
                  </dd>
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd>{detail.type}</dd>
                  <dt className="text-muted-foreground">Área</dt>
                  <dd>{detail.area}</dd>
                  <dt className="text-muted-foreground">Grados</dt>
                  <dd>
                    {detail.grades.length > 0 ? detail.grades.join(" · ") : "Todo el colegio"}
                  </dd>
                  <dt className="text-muted-foreground">Visible para</dt>
                  <dd>
                    {detail.visible_to === "all" ? "Docentes y estudiantes" : detail.visible_to}
                  </dd>
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
                  Colegios con acceso
                </h3>
                <ul className="flex flex-col divide-y divide-border">
                  {detail.schools.map((school) => (
                    <li key={school.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{school.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {school.short_code}
                          {school.plan ? ` · ${school.plan}` : ""} · {school.students} estudiantes
                        </span>
                      </span>
                      <AccessSwitch
                        checked={enabled.has(school.id)}
                        disabled={setSchools.isPending}
                        label={`Acceso de ${school.name}`}
                        onToggle={() => void toggleSchool(school.id, school.name)}
                      />
                    </li>
                  ))}
                  {detail.schools.length === 0 && (
                    <li className="py-2.5 text-sm text-muted-foreground">
                      Este material todavía no tiene acceso.
                    </li>
                  )}
                </ul>
              </section>

              {pendingRemoval && (
                <div className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-3 text-sm">
                  <p className="font-semibold text-warning">
                    Se va a quitar el acceso de {pendingRemoval.length} colegio(s):
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-warning">
                    {pendingRemoval.map((school) => (
                      <li key={school.id}>{school.name}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-warning">
                    El cambio es inmediato para los docentes y estudiantes del colegio.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void confirmRemoval()}
                      disabled={setSchools.isPending}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemoval(null)}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

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
