import { AlertTriangle, BookOpen, Check } from "lucide-react";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Tag } from "@/components/ui-kit";
import { useCatalog, useGrantMaterialSchools } from "@/lib/platform/hooks";

/**
 * Enable material for several schools at once.
 *
 * The schools are the ones the platform team selected in the table;
 * here the material is picked. Nobody loses access: the schools that
 * already saw the piece keep seeing it.
 */
export function EnableMaterials({
  open,
  schoolIds,
  schoolNames,
  onClose,
}: {
  open: boolean;
  schoolIds: string[];
  schoolNames: string[];
  onClose: () => void;
}) {
  const catalog = useCatalog({ page: 1, per_page: 50 });
  const grant = useGrantMaterialSchools();

  const [picked, setPicked] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const materials = catalog.data?.items ?? [];

  function toggle(id: string) {
    setPicked((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function onSubmit() {
    if (picked.length === 0) {
      setProblem("Elige al menos un material.");
      return;
    }
    setProblem(null);
    let granted = 0;
    try {
      for (const materialId of picked) {
        await grant.mutateAsync({ id: materialId, school_ids: schoolIds });
        granted += 1;
      }
      setNotice(
        `El material quedó habilitado para ${schoolIds.length} colegio(s): ${granted} pieza(s).`,
      );
      setPicked([]);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo habilitar el material.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPicked([]);
          setNotice(null);
          setProblem(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Habilitar material</DialogTitle>
          <DialogDescription>
            El material quedará disponible para {schoolIds.length}{" "}
            {schoolIds.length === 1 ? "colegio" : "colegios"}: {schoolNames.join(", ")}.
          </DialogDescription>
        </DialogHeader>

        {notice && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-xs text-success"
          >
            <Check className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
            {notice}
          </p>
        )}

        <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
          {materials.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              No hay material en el catálogo.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {materials.map((material) => {
                const on = picked.includes(material.id);
                return (
                  <li key={material.id}>
                    <button
                      type="button"
                      onClick={() => toggle(material.id)}
                      aria-pressed={on}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
                    >
                      <span
                        aria-hidden
                        className={`grid size-4 shrink-0 place-items-center rounded border ${
                          on ? "border-primary bg-primary text-primary-foreground" : "border-input"
                        }`}
                      >
                        {on ? <Check className="size-3" strokeWidth={2.4} /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{material.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {material.code} · {material.type} · {material.area}
                        </span>
                      </span>
                      <Tag>{material.schools.length} colegio(s)</Tag>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <BookOpen className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
          <span>
            El material se habilita con el estado que tenga: si está en borrador o en revisión,
            sigue sin ser visible para los docentes.
          </span>
        </p>

        {problem && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive-soft px-3 py-2 text-xs text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
            {problem}
          </p>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={() => {
              setPicked([]);
              setNotice(null);
              setProblem(null);
              onClose();
            }}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={grant.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Check className="size-4" strokeWidth={1.9} aria-hidden />
            Habilitar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
