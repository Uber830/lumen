import { Building2, Info } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { StatusPill } from "@/components/ui-kit";
import { useMaterial } from "@/lib/platform/hooks";

/**
 * The schools that can see a material.
 *
 * The row of the catalog shows one or two schools and the number of the
 * ones that are not on screen. This dialog opens from that number and
 * lists every school with access, read from the detail of the material:
 * the listing cuts the list, the detail does not.
 *
 * The access is changed from the sheet of the school, where the switch
 * of every piece lives.
 */
export function SchoolsOfMaterial({
  materialId,
  onClose,
}: {
  materialId: string | null;
  onClose: () => void;
}) {
  const material = useMaterial(materialId);
  const schools = material.data?.schools ?? [];

  return (
    <Dialog open={Boolean(materialId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Colegios con acceso</DialogTitle>
          <DialogDescription>
            {material.data ? material.data.title : "Los colegios que pueden ver esta pieza."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border border-border">
          {material.isLoading ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">Cargando…</p>
          ) : schools.length > 0 ? (
            <ul className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto">
              {schools.map((school) => (
                <li key={school.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <Building2 className="size-4" strokeWidth={1.9} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{school.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {school.short_code}
                      {school.plan ? ` · ${school.plan}` : ""} · {school.students} estudiantes
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

        <p className="text-xs text-muted-foreground">
          {schools.length} colegio(s) con acceso a esta pieza.
        </p>

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
