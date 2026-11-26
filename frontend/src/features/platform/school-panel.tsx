import { AlertTriangle, BookOpen, Check, X } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { StatusPill, Tag } from "@/components/ui-kit";
import { AccessSwitch } from "@/features/platform/access-switch";
import { ApiError } from "@/lib/api/client";
import { useSchool, useSetSchoolMaterialAccess } from "@/lib/platform/hooks";
import { MATERIAL_STATUS_LABEL, MATERIAL_STATUS_TONE } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/**
 * The sheet of a school.
 *
 * It shows the figures of the institution and its coverage of the
 * catalog: every piece has a switch, and the change is saved right
 * away. When the server asks for a confirmation (a published piece
 * that loses a school), the sheet says which schools are affected
 * before sending the same request confirmed.
 */
export function SchoolPanel({
  schoolId,
  onClose,
  className,
}: {
  schoolId: string | null;
  onClose: () => void;
  className?: string;
}) {
  const school = useSchool(schoolId);
  const setAccess = useSetSchoolMaterialAccess();

  const [pendingRemoval, setPendingRemoval] = useState<{ id: string; name: string }[] | null>(null);
  // The piece that was about to lose the school.
  const [pendingMaterial, setPendingMaterial] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const detail = school.data;

  async function toggleMaterial(materialId: string, title: string, enabled: boolean) {
    if (!detail) return;
    setProblem(null);
    try {
      await setAccess.mutateAsync({ schoolId: detail.id, materialId, enabled });
      setNotice(`${title}: ${enabled ? "con acceso" : "sin acceso"}.`);
    } catch (error) {
      // A published piece that loses a school needs a confirmation:
      // the server says which schools are affected.
      if (error instanceof ApiError && error.status === 409) {
        const affected = (error.body as { affected?: { id: string; name: string }[] })?.affected;
        setPendingRemoval(affected ?? []);
        setPendingMaterial(materialId);
        return;
      }
      setProblem(error instanceof Error ? error.message : "No se pudo guardar el cambio.");
    }
  }

  async function confirmRemoval() {
    if (!detail || !pendingMaterial) return;
    setProblem(null);
    try {
      await setAccess.mutateAsync({
        schoolId: detail.id,
        materialId: pendingMaterial,
        enabled: false,
        confirm: true,
      });
      setNotice("El acceso se actualizó.");
      setPendingRemoval(null);
      setPendingMaterial(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo guardar el cambio.");
    }
  }

  return (
    <Dialog open={Boolean(schoolId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showClose={false}
        className={cn(
          "fixed right-0 top-0 left-auto flex h-dvh max-h-none w-full max-w-lg translate-x-0 translate-y-0 flex-col gap-0 overflow-y-auto rounded-none border-l border-border bg-card p-0 shadow-lift sm:rounded-none",
          className,
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">{detail?.name ?? "Colegio"}</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {detail
                ? [detail.short_code, detail.city].filter(Boolean).join(" · ")
                : "Los datos de la institución."}
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
                  El colegio
                </h3>
                <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    <StatusPill
                      label={detail.status === "active" ? "Activo" : detail.status}
                      tone={detail.status === "active" ? "success" : "muted"}
                    />
                  </dd>
                  <dt className="text-muted-foreground">Estudiantes</dt>
                  <dd>
                    {detail.students > 0 ? (
                      detail.students.toLocaleString("es-CO")
                    ) : (
                      <span className="text-muted-foreground">Sin reportar</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Docentes</dt>
                  <dd>
                    {detail.teachers > 0 ? (
                      detail.teachers.toLocaleString("es-CO")
                    ) : (
                      <span className="text-muted-foreground">Sin reportar</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Material</dt>
                  <dd>
                    {detail.covered} de {detail.total} piezas publicadas
                  </dd>
                </dl>
                <p className="mt-2 text-xs text-muted-foreground">
                  Los grados, los estudiantes y los docentes los carga y los actualiza el
                  administrador del colegio.
                </p>
              </section>

              <section>
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  <BookOpen className="size-3.5" strokeWidth={1.9} aria-hidden />
                  Cobertura de catálogo
                </h3>
                <ul className="flex flex-col divide-y divide-border">
                  {detail.catalog.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.code} · {item.type} · {item.area}
                        </span>
                      </span>
                      <StatusPill
                        label={MATERIAL_STATUS_LABEL[item.status]}
                        tone={MATERIAL_STATUS_TONE[item.status]}
                      />
                      <AccessSwitch
                        checked={item.enabled}
                        disabled={setAccess.isPending}
                        label={`Acceso de ${detail.name} a ${item.title}`}
                        onToggle={() => void toggleMaterial(item.id, item.title, !item.enabled)}
                      />
                    </li>
                  ))}
                  {detail.catalog.length === 0 && (
                    <li className="py-2.5 text-sm text-muted-foreground">
                      La biblioteca de recursos está vacía.
                    </li>
                  )}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  El interruptor habilita o retira el material para este colegio. El cambio aplica
                  de inmediato.
                </p>
              </section>

              {pendingRemoval && pendingRemoval.length > 0 && (
                <div className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-3 text-sm">
                  <p className="font-semibold text-warning">
                    Se va a quitar el acceso de {pendingRemoval.length} colegio(s):
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-xs text-warning">
                    {pendingRemoval.map((school) => (
                      <li key={school.id}>{school.name}</li>
                    ))}
                  </ul>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void confirmRemoval()}
                      disabled={setAccess.isPending}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingRemoval(null);
                        setPendingMaterial(null);
                      }}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {detail && (
          <div className="flex items-center gap-2 border-t border-border px-5 py-4">
            <Tag>
              {detail.covered} de {detail.total} con acceso
            </Tag>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
