import { Building2, Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { StatusPill, Tag } from "@/components/ui-kit";
import type { MaterialSummary } from "@/lib/platform/types";

/**
 * The schools that can see a material.
 *
 * It is the cell of the catalog, opened: it says who sees the piece
 * and how many schools are not on the list. The access is changed from
 * the sheet of the school, where the switch of every piece lives.
 */
export function SchoolsOfMaterial({
  material,
  schoolNames,
  onClose,
}: {
  material: MaterialSummary | null;
  schoolNames: Map<string, string>;
  onClose: () => void;
}) {
  return (
    <Dialog open={Boolean(material)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Colegios con acceso</DialogTitle>
          <DialogDescription>{material?.title}</DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border">
          {material && material.schools.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {material.schools.map((school) => (
                <li key={school.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="size-4" strokeWidth={1.9} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {schoolNames.get(school.id) ?? school.name}
                    </span>
                  </span>
                  <StatusPill label="Habilitado" tone="success" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">
              Este material todavía no tiene colegio con acceso.
            </p>
          )}
        </div>

        {material && material.schools_extra > 0 && (
          <p className="text-xs text-muted-foreground">
            <Tag>+{material.schools_extra}</Tag>{" "}
            <span className="ml-1">colegios más tienen acceso a esta pieza.</span>
          </p>
        )}

        <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
          <span>
            Para habilitar o retirar el material de un colegio, entra a{" "}
            <b className="text-foreground">Colegios → Gestionar</b>: allí está el interruptor de
            cada pieza.
          </span>
        </p>

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted"
          >
            Cerrar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
