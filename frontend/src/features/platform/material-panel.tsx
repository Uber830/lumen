import { audienceLabel } from "@/features/resources/resource-card";
import { AlertTriangle, Check, FileText, History, Link2, Save, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { Button, StatusPill, Tag } from "@/components/ui-kit";
import {
  useCatalogOptions,
  useChangeMaterialStatus,
  useDeleteMaterial,
  useMaterial,
  useUpdateMaterial,
} from "@/lib/platform/hooks";
import {
  MATERIAL_STATUS_HINT,
  MATERIAL_STATUS_LABEL,
  MATERIAL_STATUS_TONE,
  type MaterialDetail,
  type MaterialStatus,
} from "@/lib/platform/types";
import { cn } from "@/lib/utils";

/**
 * The side panel of a material.
 *
 * It shows the metadata, the state of the piece, the schools that can
 * see it and the history. The metadata is **edited** from here: the
 * title, the type, the area, the grades and who it is for. The access
 * is not changed from here: the panel says which schools have it, and
 * the switch per school lives in the sheet of the school (Colegios →
 * Gestionar), where the piece is listed with the rest of the catalog.
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
          // A centered modal, not a drawer: the piece is managed in the
          // middle of the screen, where the form can be read at once.
          // The head and the foot stay put; the form in the middle
          // scrolls.
          "max-h-[88vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
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

        <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5">
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

                <MaterialMetaForm
                  key={detail.id}
                  detail={detail}
                  onSaved={(message) => setNotice(message)}
                  onProblem={(message) => setProblem(message)}
                />

                <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Origen</dt>
                  <dd className="flex items-center gap-1.5">
                    {detail.origin === "upload" ? (
                      <FileText className="size-3.5" strokeWidth={1.9} aria-hidden />
                    ) : (
                      <Link2 className="size-3.5" strokeWidth={1.9} aria-hidden />
                    )}
                    {detail.origin === "upload" ? "Carga manual" : "Enlace externo"}
                  </dd>
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
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3.5">
            {detail.available_transitions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => void moveTo(status as MaterialStatus)}
                disabled={changeStatus.isPending}
                className="rounded-idx bg-primary px-2.5 py-1 text-[11.8px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
              >
                {MATERIAL_STATUS_LABEL[status as MaterialStatus]}
              </button>
            ))}
            {detail.status === "draft" && (
              <button
                type="button"
                onClick={() => void onDelete()}
                disabled={removeMaterial.isPending}
                className="inline-flex items-center gap-1.5 rounded-idx border border-destructive/40 px-2.5 py-1 text-[11.8px] font-semibold text-destructive transition-colors hover:bg-destructive-soft disabled:opacity-60"
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

/**
 * The form of the metadata of a piece.
 *
 * The values of the piece are changed from here: the title, the type,
 * the area, the grades and who it is for. The form starts with what
 * the piece says now, and the button only works when something
 * changed: the history of the material says what was changed.
 *
 * The piece is its own component so the form starts again from the
 * values of the piece that is open: the parent gives it a key.
 */
function MaterialMetaForm({
  detail,
  onSaved,
  onProblem,
}: {
  detail: MaterialDetail;
  /** Called when the piece is already saved. */
  onSaved: (message: string) => void;
  /** Called when the save did not go through. */
  onProblem: (message: string) => void;
}) {
  const options = useCatalogOptions();
  const update = useUpdateMaterial();

  const [title, setTitle] = useState(detail.title);
  const [type, setType] = useState(detail.type);
  const [area, setArea] = useState(detail.area);
  const [grades, setGrades] = useState<string[]>(detail.grades);
  const [visibleTo, setVisibleTo] = useState(detail.visible_to);
  const [description, setDescription] = useState(detail.description ?? "");

  function toggleGrade(grade: string) {
    setGrades((current) =>
      current.includes(grade) ? current.filter((value) => value !== grade) : [...current, grade],
    );
  }

  const dirty =
    title !== detail.title ||
    type !== detail.type ||
    area !== detail.area ||
    visibleTo !== detail.visible_to ||
    description !== (detail.description ?? "") ||
    grades.join("|") !== detail.grades.join("|");

  async function onSave() {
    try {
      await update.mutateAsync({
        id: detail.id,
        input: {
          title: title.trim(),
          type,
          area,
          grades,
          visible_to: visibleTo,
          description: description.trim() || null,
        },
      });
      onSaved("Los datos del recurso quedaron guardados.");
    } catch (error) {
      onProblem(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    }
  }

  return (
    <div className="space-y-3">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Título
        </span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Tipo
          </span>
          <select
            value={type}
            onChange={(event) => setType(event.target.value)}
            className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            {(options.data?.types ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Área
          </span>
          <select
            value={area}
            onChange={(event) => setArea(event.target.value)}
            className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
          >
            {(options.data?.areas ?? []).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Grados
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(options.data?.grades ?? []).map((grade) => (
            <button
              key={grade}
              type="button"
              onClick={() => toggleGrade(grade)}
              aria-pressed={grades.includes(grade)}
              className={cn(
                "rounded-idx px-2.5 py-1 text-xs font-medium transition-colors",
                grades.includes(grade)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {grade}
            </button>
          ))}
        </div>
        <span className="mt-1.5 block text-xs text-muted-foreground">
          Sin grados, el recurso aplica a todo el colegio.
        </span>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Visible para
        </span>
        <select
          value={visibleTo}
          onChange={(event) => setVisibleTo(event.target.value)}
          className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
        >
          {(options.data?.visible_to ?? ["all"]).map((value) => (
            <option key={value} value={value}>
              {audienceLabel(value)}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Descripción
        </span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          className="mt-1.5 w-full resize-y rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
        />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <Button
          size="sm"
          icon={Save}
          disabled={!dirty || update.isPending}
          onClick={() => void onSave()}
        >
          {update.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
        {!dirty && (
          <span className="text-xs text-muted-foreground">No hay cambios que guardar.</span>
        )}
      </div>
    </div>
  );
}
