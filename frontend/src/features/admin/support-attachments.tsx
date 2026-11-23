// =============================================================================
// The attachments of a support request.
// -----------------------------------------------------------------------------
// The admin writes to the support team and can attach a file: a screenshot
// of the problem, a document, a photo of the material. The file goes to
// the store of the school and the thread keeps the path of it.
//
// The limit is 10 MB per file, the same one the API enforces.
// =============================================================================

import { useRef, useState } from "react";
import { FileText, Paperclip, Upload } from "lucide-react";

import { useUploadSupportAttachment } from "@/lib/school/support";

/** The biggest file the admin can attach. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** One file the admin picked, with the path it got in the store. */
export type PickedAttachment = {
  /** The path of the file: it is what the message keeps. */
  id: string;
  name: string;
  size: number;
};

export function SupportAttachmentField({
  attachments,
  onChange,
}: {
  attachments: PickedAttachment[];
  onChange: (next: PickedAttachment[]) => void;
}) {
  const upload = useUploadSupportAttachment();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File) {
    setError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("El archivo pesa más de 10 MB. Elige uno más liviano.");
      return;
    }
    try {
      const uploaded = await upload.mutateAsync(file);
      onChange([...attachments, { id: uploaded.id, name: uploaded.name, size: uploaded.size }]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo adjuntar el archivo.");
    }
  }

  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Adjuntar
      </span>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mt-1.5 flex w-full items-center gap-3 rounded-idx border border-dashed border-input bg-secondary px-4 py-3 text-left transition-colors hover:border-primary"
      >
        <Upload className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.9} aria-hidden />
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold">Adjuntar un archivo</span>
          <span className="block text-[12px] text-muted-foreground">
            PDF, imagen o documento · máximo 10 MB
          </span>
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onPick(file);
          // The same file can be chosen again after a change.
          event.target.value = "";
        }}
      />

      {attachments.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2.5 rounded-idx border border-border bg-card px-3 py-2"
            >
              <FileText
                className="size-4 shrink-0 text-muted-foreground"
                strokeWidth={1.9}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{attachment.name}</span>
                <span className="block text-[11.6px] text-muted-foreground">
                  {formatSize(attachment.size)} · adjunto
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(attachments.filter((item) => item.id !== attachment.id))}
                aria-label={`Quitar ${attachment.name}`}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Paperclip className="size-3.5" strokeWidth={1.9} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {(error || upload.error) && (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          {error ?? upload.error?.message}
        </p>
      )}
    </div>
  );
}

/** The size of a file, in the units a person reads. */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
