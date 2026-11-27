// =============================================================================
// The preview of a resource of the school.
// -----------------------------------------------------------------------------
// The eye of the library: the piece is shown as it is, so the admin of the
// school sees what it loaded before it decides anything about it.
//
// The file is served by the API and shown here, without downloading it: an
// image as an image, a pdf in the reader of the browser, a video with its
// controls. A format the browser cannot paint says so plainly.
// =============================================================================

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/dialog";
import { Button } from "@/components/ui-kit";
import { ResourceViewer } from "@/features/resources/resource-viewer";
import { fetchSchoolMaterialFile, useSchoolMaterialDetail } from "@/lib/school/material";

export function SchoolMaterialPreview({
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
      <DialogContent className="max-w-4xl">
        <DialogTitle className="text-[16px]">
          {detail?.title ?? (material.isLoading ? "Cargando…" : "Recurso")}
        </DialogTitle>
        <DialogDescription className="font-mono text-[12px]">
          {detail
            ? `${detail.ref} · ${file ? file.size_label : "sin archivo"}`
            : "El recurso, como se ve."}
        </DialogDescription>

        <ResourceViewer file={file} materialId={materialId} loadFile={fetchSchoolMaterialFile} />

        {detail?.description ? (
          <p className="text-[13px] text-muted-foreground">{detail.description}</p>
        ) : null}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
