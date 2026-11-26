// =============================================================================
// The form that edits a resource.
// -----------------------------------------------------------------------------
// The pencil of the library: the values of a piece are changed here —
// the title, the type, the area, the grades, who it is for and the
// description.
//
// The piece is its own component so the form starts again from the
// values of the piece that is open: the parent gives it a key.
//
// The modal is centered, like the one that shows the summary: the
// piece is managed in the middle of the screen, where the form can be
// read at once.
// =============================================================================

import { Pencil, Save } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { Button } from "@/components/ui-kit";
import { audienceLabel } from "@/features/resources/resource-card";
import { useCatalogOptions, useMaterial, useUpdateMaterial } from "@/lib/platform/hooks";
import type { MaterialDetail } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

export function MaterialEditor({
  materialId,
  onClose,
}: {
  materialId: string | null;
  onClose: () => void;
}) {
  const material = useMaterial(materialId);
  const detail = material.data;

  return (
    <Dialog open={Boolean(materialId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[88vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
        )}
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">Editar el recurso</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {detail ? `${detail.code} · ${detail.title}` : "Los datos del recurso."}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="size-4" strokeWidth={1.9} />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
          {detail && (
            <MaterialMetaForm
              key={detail.id}
              detail={detail}
              onSaved={onClose}
              onProblem={onClose}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The form of the metadata of a piece.
 *
 * The form starts with what the piece says now, and the button only
 * works when something changed: the history of the material says what
 * was changed.
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
  const [problem, setProblem] = useState<string | null>(null);

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
      const message =
        error instanceof Error ? error.message : "No se pudieron guardar los cambios.";
      setProblem(message);
      onProblem(message);
    }
  }

  return (
    <div className="space-y-3">
      {problem && (
        <p
          role="alert"
          className="rounded-idx border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive"
        >
          {problem}
        </p>
      )}

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
