// =============================================================================
// The attachments of a support request.
// -----------------------------------------------------------------------------
// The admin writes to the support team and can attach a file: a screenshot
// of the problem, a document, a photo of the material. The file goes to
// the store of the school and the thread keeps the path of it.
//
// The support team answers with files too: the field is the same one and
// the door of the upload is the one of the role that writes.
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
  /**
   * The file that is not in the store yet: it waits for the moment the
   * answer is sent. The platform uses it when one answer goes to
   * several schools, because each one needs its own copy.
   */
  file?: File;
};

/** The door of the upload: the school and the platform have their own. */
export type AttachmentUploader = (file: File) => Promise<PickedAttachment>;

export function SupportAttachmentField({
  attachments,
  onChange,
  upload,
}: {
  attachments: PickedAttachment[];
  onChange: (next: PickedAttachment[]) => void;
  /** The upload of the role that writes; the school by default. */
  upload?: AttachmentUploader;
}) {
  const schoolUpload = useUploadSupportAttachment();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File) {
    setError(null);
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError("El archivo pesa más de 10 MB. Elige uno más liviano.");
      return;
    }
    try {
      const uploaded = upload
        ? await upload(file)
        : await schoolUpload
            .mutateAsync(file)
            .then((item) => ({ id: item.id, name: item.name, size: item.size }));
      onChange([...attachments, uploaded]);
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
                  {attachment.file
                    ? `${formatSize(attachment.size)} · se envía con la respuesta`
                    : `${formatSize(attachment.size)} · adjunto`}
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

      {(error || schoolUpload.error) && (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          {error ?? schoolUpload.error?.message}
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
