// =============================================================================
// The preview of a resource.
// -----------------------------------------------------------------------------
// The eye of the library: the piece is shown as it is, so the team sees
// what it is publishing before it decides anything about it.
//
// The file is served by the API and shown here, without downloading it:
// an image as an image, a pdf in the reader of the browser, a video with
// its controls. A piece that is only a link says so and offers the link.
// =============================================================================

import { ExternalLink } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { Button } from "@/components/ui-kit";
import { ResourceViewer } from "@/features/resources/resource-viewer";
import { fetchPlatformMaterialFile, useMaterial } from "@/lib/platform/hooks";

export function MaterialPreview({
  materialId,
  onClose,
}: {
  materialId: string | null;
  onClose: () => void;
}) {
  const material = useMaterial(materialId);
  const detail = material.data;
  // The file that is the piece: the primary one, or the first that came.
  const file = detail?.files.find((item) => item.is_primary) ?? detail?.files[0] ?? null;

  return (
    <Dialog open={Boolean(materialId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogTitle className="text-[16px]">
          {detail?.title ?? (material.isLoading ? "Cargando…" : "Recurso")}
        </DialogTitle>
        <DialogDescription>
          {file ? `${file.file_name} · ${file.size_label}` : "El recurso, como se ve."}
        </DialogDescription>

        {detail?.origin === "link" && detail.external_url ? (
          <div className="space-y-3">
            <p className="text-[13px] text-muted-foreground">
              Este recurso es un enlace externo: el archivo no vive en la plataforma.
            </p>
            <a
              href={detail.external_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-idx border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLink className="size-4" strokeWidth={1.9} aria-hidden />
              Abrir el recurso
            </a>
          </div>
        ) : (
          <ResourceViewer
            file={file}
            materialId={file?.id ?? null}
            loadFile={fetchPlatformMaterialFile}
          />
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
