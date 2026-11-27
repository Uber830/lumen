// =============================================================================
// The form that edits a resource.
// -----------------------------------------------------------------------------
// The pencil of the library: the values of a piece are changed here —
// the title, the type, the area, the grades, who it is for, the
// description and the schools that can see it.
//
// The piece is its own component so the form starts again from the
// values of the piece that is open: the parent gives it a key.
//
// The modal is centered, like the one that shows the summary: the
// piece is managed in the middle of the screen, where the form can be
// read at once.
// =============================================================================

import { Save, X } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { Button } from "@/components/ui-kit";
import { audienceLabel } from "@/features/resources/resource-card";
import { ApiError } from "@/lib/api/client";
import {
  useCatalogOptions,
  useMaterial,
  usePlatformSchools,
  useSetMaterialSchools,
  useUpdateMaterial,
} from "@/lib/platform/hooks";
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
      <DialogContent className="max-h-[88vh] max-w-2xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0">
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
            <X className="size-4" strokeWidth={1.9} />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5">
          {detail && <MaterialMetaForm key={detail.id} detail={detail} onSaved={onClose} />}
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
}: {
  detail: MaterialDetail;
  /** Called when the piece is already saved. */
  onSaved: (message: string) => void;
}) {
  const options = useCatalogOptions();
  const schools = usePlatformSchools({ per_page: 50 });
  const update = useUpdateMaterial();
  const setSchools = useSetMaterialSchools();

  const [title, setTitle] = useState(detail.title);
  const [type, setType] = useState(detail.type);
  const [area, setArea] = useState(detail.area);
  const [grades, setGrades] = useState<string[]>(detail.grades);
  const [visibleTo, setVisibleTo] = useState(detail.visible_to);
  const [description, setDescription] = useState(detail.description ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  // The schools that see the piece now.
  const currentSchools = detail.schools.map((school) => school.id);
  const [schoolIds, setSchoolIds] = useState<string[]>(currentSchools);
  // The decision comes first: the whole network or the schools that are
  // picked. The piece is for everyone when it reaches every school of
  // the network, so the decision is read from the data until the user
  // picks one.
  const [chosenScope, setChosenScope] = useState<"all" | "some" | null>(null);
  const networkSize = schools.data?.total ?? null;
  const scope: "all" | "some" =
    chosenScope ?? (networkSize !== null && currentSchools.length >= networkSize ? "all" : "some");
  // A published piece that loses a school asks for a confirmation: the
  // server says which schools are affected.
  const [pending, setPending] = useState<{ id: string; name: string }[] | null>(null);

  function toggleGrade(grade: string) {
    setGrades((current) =>
      current.includes(grade) ? current.filter((value) => value !== grade) : [...current, grade],
    );
  }

  function toggleSchool(schoolId: string) {
    setSchoolIds((current) =>
      current.includes(schoolId)
        ? current.filter((value) => value !== schoolId)
        : [...current, schoolId],
    );
  }

  // The access is the same when the piece reaches the same schools: the
  // network is unknown while the list loads, so the decision always
  // counts as a change until it is known.
  const sameSchools =
    scope === "all"
      ? networkSize !== null && currentSchools.length >= networkSize
      : [...schoolIds].sort().join("|") === [...currentSchools].sort().join("|");

  const dirty =
    title !== detail.title ||
    type !== detail.type ||
    area !== detail.area ||
    visibleTo !== detail.visible_to ||
    description !== (detail.description ?? "") ||
    grades.join("|") !== detail.grades.join("|") ||
    !sameSchools;

  /** The access of the piece: the schools that can see it. */
  async function saveSchools(confirm: boolean) {
    await setSchools.mutateAsync({
      id: detail.id,
      school_ids: scope === "all" ? [] : schoolIds,
      all_schools: scope === "all",
      confirm,
    });
  }

  async function onSave() {
    setProblem(null);
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

      // The access of the piece, when it changed.
      if (!sameSchools) {
        try {
          await saveSchools(false);
        } catch (error) {
          // A published piece that loses a school asks for a
          // confirmation: the server says which schools are affected.
          if (error instanceof ApiError && error.status === 409) {
            const affected = (error.body as { affected?: { id: string; name: string }[] })
              ?.affected;
            setPending(affected ?? []);
            return;
          }
          throw error;
        }
      }

      onSaved("Los datos del recurso quedaron guardados.");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    }
  }

  async function onConfirmSchools() {
    setProblem(null);
    try {
      await saveSchools(true);
      setPending(null);
      onSaved("Los datos del recurso quedaron guardados.");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo cambiar el acceso.");
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

      {pending && (
        <div className="rounded-idx border border-warning/40 bg-warning-soft px-3 py-2.5">
          <p className="text-[13px] font-semibold text-warning">
            Esta pieza va a dejar de verse en {pending.length}{" "}
            {pending.length === 1 ? "colegio" : "colegios"}:
          </p>
          <p className="mt-1 text-xs text-warning">{pending.map((s) => s.name).join(", ")}</p>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={() => void onConfirmSchools()}>
              Sí, cambiar el acceso
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancelar
            </Button>
          </div>
        </div>
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

      {/* The decision comes before the list of schools: the piece goes
          to the whole network or to the schools that are picked. */}
      <div>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Colegios que pueden verlo
        </span>
        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
          {(
            [
              {
                value: "all" as const,
                label: "Todos los colegios",
                hint: "La pieza queda disponible para toda la red.",
              },
              {
                value: "some" as const,
                label: "Ciertos colegios",
                hint: "Solo ven la pieza los que se elijan.",
              },
            ] as const
          ).map((choice) => {
            const on = scope === choice.value;
            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => setChosenScope(choice.value)}
                aria-pressed={on}
                className={cn(
                  "rounded-idx border px-3 py-2 text-left transition-colors",
                  on ? "border-primary bg-primary-soft" : "border-border hover:border-line-2",
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border text-[10px] text-primary-foreground",
                      on ? "border-primary bg-primary" : "border-line-2",
                    )}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium">{choice.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {choice.hint}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {scope === "some" && (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {(schools.data?.items ?? []).map((school) => {
              const on = schoolIds.includes(school.id);
              return (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => toggleSchool(school.id)}
                  aria-pressed={on}
                  className={cn(
                    "flex items-center gap-2.5 rounded-idx border px-3 py-2 text-left transition-colors",
                    on ? "border-primary bg-primary-soft" : "border-border hover:border-line-2",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border text-[10px] text-primary-foreground",
                      on ? "border-primary bg-primary" : "border-line-2",
                    )}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{school.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {school.short_code} · {school.students} estudiantes
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <span className="mt-1.5 block text-xs text-muted-foreground">
          {scope === "all"
            ? "El recurso queda para todos los colegios de la red."
            : "Solo estos colegios verán el recurso."}
        </span>
      </div>

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
          disabled={(!dirty && !pending) || update.isPending}
          onClick={() => void onSave()}
        >
          {update.isPending ? "Guardando..." : "Guardar cambios"}
        </Button>
        {!dirty && !pending && (
          <span className="text-xs text-muted-foreground">No hay cambios que guardar.</span>
        )}
      </div>
    </div>
  );
}
