// =============================================================================
// The viewer of a resource.
// -----------------------------------------------------------------------------
// The material is consulted inside the platform: the file is served by
// the API and shown here, without downloading it.
//
// What can be shown depends on the format:
//
//   - an image, as an image;
//   - a pdf, in the reader of the browser;
//   - a video, with its controls.
//
// A format the browser cannot paint (a docx, an epub, a zip) says so
// plainly instead of pretending.
// =============================================================================

import { FileWarning } from "lucide-react";
import { useEffect, useState } from "react";

/** What the viewer needs to know about the file of a resource. */
export type ViewerFile = {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  size_label: string;
};

export function ResourceViewer({
  file,
  materialId,
  loadFile,
}: {
  /** The file of the resource, when it has one. */
  file: ViewerFile | null;
  materialId: string | null;
  /** Fetches the content of the file. */
  loadFile: (id: string) => Promise<Blob>;
}) {
  if (!file || !materialId) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Este recurso no tiene archivo: es una pieza del catálogo.
      </p>
    );
  }

  // The key is the resource: a new one starts with its own file, and
  // the address of the previous one dies with it.
  return <ResourceFile key={materialId} file={file} materialId={materialId} loadFile={loadFile} />;
}

function ResourceFile({
  file,
  materialId,
  loadFile,
}: {
  file: ViewerFile;
  materialId: string;
  loadFile: (id: string) => Promise<Blob>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    loadFile(materialId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setProblem(error instanceof Error ? error.message : "No se pudo cargar el archivo.");
      });

    return () => {
      cancelled = true;
      // The address of the file is temporary: it dies with the modal.
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [materialId, loadFile]);

  if (problem) {
    return (
      <p role="alert" className="text-[13px] text-destructive">
        {problem}
      </p>
    );
  }

  if (!url) {
    return (
      <div className="flex h-[320px] items-center justify-center rounded-idx bg-muted/40 text-[13px] text-muted-foreground">
        Cargando el archivo…
      </div>
    );
  }

  const mime = file.mime_type;

  if (mime.startsWith("image/")) {
    return (
      <div className="flex max-h-[62vh] justify-center overflow-auto rounded-idx bg-muted/40 p-3">
        <img src={url} alt={file.file_name} className="max-h-[58vh] w-auto rounded-idx" />
      </div>
    );
  }

  if (mime === "application/pdf") {
    return (
      <iframe
        src={url}
        title={file.file_name}
        className="h-[62vh] w-full rounded-idx border border-border"
      />
    );
  }

  if (mime.startsWith("video/")) {
    return <video src={url} controls className="max-h-[62vh] w-full rounded-idx" />;
  }

  return (
    <div className="flex items-start gap-3 rounded-idx border border-border bg-muted/40 p-4">
      <FileWarning
        className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        strokeWidth={1.8}
        aria-hidden
      />
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-foreground">
          Este formato no se puede mostrar aquí
        </p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          El archivo <b className="font-mono">{file.file_name}</b> ({file.size_label}) queda en el
          storage de la plataforma. Los formatos que el navegador puede pintar son las imágenes, los
          PDF y los videos.
        </p>
      </div>
    </div>
  );
}
