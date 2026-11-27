// =============================================================================
// The form that edits a resource of the school.
// -----------------------------------------------------------------------------
// The pencil of the library: the values of a piece the school loaded are
// changed here — the title, the type, the area, who it is for and the
// description.
//
// The file never changes: to replace it, the school loads the resource
// again. The piece is its own component so the form starts again from the
// values of the piece that is open: the parent gives it a key.
// =============================================================================

import { Save, X } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { Button } from "@/components/ui-kit";
import { audienceLabel } from "@/features/resources/resource-card";
import {
  useSchoolMaterialDetail,
  useSchoolMaterialOptions,
  useUpdateSchoolMaterial,
  type MaterialDetail,
} from "@/lib/school/material";

export function SchoolMaterialEditor({
  materialId,
  onClose,
}: {
  materialId: string | null;
  onClose: () => void;
}) {
  const material = useSchoolMaterialDetail(materialId);
  const detail = material.data;

  return (
    <Dialog open={Boolean(materialId)} onOpenChange={(open) => !open && onClose()}>
      {/* La X de la esquina la dibuja el editor: el diálogo no pone la
          suya, o se verían dos encima. */}
      <DialogContent
        showClose={false}
        className="max-h-[88vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">Editar el recurso</DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {detail ? `${detail.ref} · ${detail.title}` : "Los datos del recurso."}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-4" strokeWidth={1.9} />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
          {detail && <MaterialForm key={detail.id} detail={detail} onSaved={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The form of the metadata of a piece.
 *
 * The form starts with what the piece says now, and the button only works
 * when something changed.
 */
function MaterialForm({
  detail,
  onSaved,
}: {
  detail: MaterialDetail;
  /** Called when the piece is already saved. */
  onSaved: (message: string) => void;
}) {
  const options = useSchoolMaterialOptions();
  const update = useUpdateSchoolMaterial();

  const [title, setTitle] = useState(detail.title);
  const [type, setType] = useState(detail.type);
  const [area, setArea] = useState(detail.area);
  const [visibleTo, setVisibleTo] = useState(detail.visible_to);
  const [description, setDescription] = useState(detail.description ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  const dirty =
    title !== detail.title ||
    type !== detail.type ||
    area !== detail.area ||
    visibleTo !== detail.visible_to ||
    description !== (detail.description ?? "");

  async function onSave() {
    setProblem(null);
    try {
      await update.mutateAsync({
        id: detail.id,
        input: {
          title: title.trim(),
          type,
          area,
          visible_to: visibleTo,
          description: description.trim() || null,
        },
      });
      onSaved("Los datos del recurso quedaron guardados.");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
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

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Visible para
        </span>
        <select
          value={visibleTo}
          onChange={(event) => setVisibleTo(event.target.value)}
          className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
        >
          {(options.data?.audiences ?? ["all"]).map((value) => (
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

      <p className="text-xs text-muted-foreground">
        El archivo no se cambia aquí: para reemplazarlo, el colegio carga el recurso de nuevo.
      </p>

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
