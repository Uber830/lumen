// =============================================================================
// The card of a resource of the school, in full.
// -----------------------------------------------------------------------------
// The third icon of the library: the piece with its characteristics.
//
// It is a **read only** sheet — the values are changed with the pencil.
// What it shows is what the school needs to know about its own piece:
// what it is, who it is for and what the file that carries it is.
// =============================================================================

import { FileText, X } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { Chip, Tag } from "@/components/ui-kit";
import { audienceLabel } from "@/features/resources/resource-card";
import { formatShortDate, useSchoolMaterialDetail } from "@/lib/school/material";

/** The kind of the file, written the way a person says it. */
const KIND_LABELS: Record<string, string> = {
  pdf: "PDF",
  docx: "Documento",
  epub: "Libro",
  mp4: "Video",
  zip: "Comprimido",
  image: "Imagen",
};

export function SchoolMaterialCard({
  materialId,
  onClose,
}: {
  materialId: string | null;
  onClose: () => void;
}) {
  const material = useSchoolMaterialDetail(materialId);
  const detail = material.data;
  const file = detail?.file ?? null;

  return (
    <Dialog open={Boolean(materialId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showClose={false}
        className="max-h-[88vh] max-w-3xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
      >
        <div className="flex items-start gap-3 border-b border-border px-5 py-4 text-left">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[16px]">
              {detail?.title ?? (material.isLoading ? "Cargando…" : "Recurso")}
            </DialogTitle>
            <DialogDescription className="mt-0.5 text-xs">
              {detail
                ? `${detail.ref} · ${file ? file.size_label : "sin archivo"}`
                : "El recurso del colegio."}
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

        <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5">
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
                  <dt className="text-muted-foreground">Visible para</dt>
                  <dd>{audienceLabel(detail.visible_to)}</dd>
                  <dt className="text-muted-foreground">Cursos</dt>
                  <dd>
                    {detail.courses.length > 0
                      ? detail.courses.map((course) => course.name).join(" · ")
                      : "Todo el colegio"}
                  </dd>
                  <dt className="text-muted-foreground">Origen</dt>
                  <dd className="flex items-center gap-1.5">
                    <FileText className="size-3.5" strokeWidth={1.9} aria-hidden />
                    {detail.origin === "colegio" ? "Cargado por el colegio" : "Equipo de Lumen"}
                  </dd>
                  {detail.description && (
                    <>
                      <dt className="text-muted-foreground">Descripción</dt>
                      <dd className="text-muted-foreground">{detail.description}</dd>
                    </>
                  )}
                </dl>

                <p className="mt-3 text-xs text-muted-foreground">
                  Los valores se cambian con el lápiz: <b className="text-foreground">Editar</b>{" "}
                  abre el formulario del recurso.
                </p>
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  Características del archivo
                </h3>

                {file ? (
                  <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
                    <dt className="text-muted-foreground">Archivo</dt>
                    <dd className="font-mono text-[12.5px]">{file.file_name}</dd>
                    <dt className="text-muted-foreground">Formato</dt>
                    <dd>{KIND_LABELS[detail.kind] ?? detail.kind}</dd>
                    <dt className="text-muted-foreground">Tamaño</dt>
                    <dd>{file.size_label}</dd>
                    <dt className="text-muted-foreground">En la biblioteca</dt>
                    <dd>{formatShortDate(detail.available_since)}</dd>
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este recurso no tiene archivo: es una pieza del catálogo.
                  </p>
                )}
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-ink-3">
                  Quién lo ve
                </h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={detail.visible_to === "all" ? "muted" : "info"}>
                    {audienceLabel(detail.visible_to)}
                  </Chip>
                  {detail.origin === "colegio" ? (
                    <Chip tone="teal">Cargado por el colegio</Chip>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </div>

        {detail && (
          <div className="flex items-center justify-end border-t border-border px-5 py-3.5">
            <Tag>
              {detail.courses.length > 0 ? `${detail.courses.length} curso(s)` : "Todo el colegio"}
            </Tag>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
