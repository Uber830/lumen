// =============================================================================
// The form that loads a resource of the school.
// -----------------------------------------------------------------------------
// A school has resources of its own: a manual of the school, a guide for
// the teachers, a text for the students. The administrator picks the file,
// writes what it is and says who it is for: that decision is the school's.
//
// The file goes up first and the piece is created with it, the same way
// the platform does it.
// =============================================================================

import { Check, FileUp, Upload } from "lucide-react";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { Button } from "@/components/ui-kit";
import { audienceLabel } from "@/features/resources/resource-card";
import {
  formatFileSize,
  useCreateSchoolMaterial,
  useSchoolMaterialOptions,
  useUploadSchoolFile,
} from "@/lib/school/material";
import { cn } from "@/lib/utils";

export function SchoolResourceDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Called when the resource is already in the library. */
  onSaved?: () => void;
}) {
  const options = useSchoolMaterialOptions();
  const upload = useUploadSchoolFile();
  const create = useCreateSchoolMaterial();

  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [area, setArea] = useState("");
  const [visibleTo, setVisibleTo] = useState("all");
  const [description, setDescription] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPickFile(picked: File | null) {
    if (!picked) return;
    setFile(picked);
    setProblem(null);
    // The name of the file proposes the title; the administrator can
    // change it.
    setTitle(picked.name.replace(/\.[^.]+$/, ""));
    try {
      const result = await upload.mutateAsync(picked);
      setFileId(result.file_id);
    } catch (error) {
      setFileId(null);
      setProblem(error instanceof Error ? error.message : "No se pudo subir el archivo.");
    }
  }

  function reset() {
    setFile(null);
    setFileId(null);
    setTitle("");
    setType("");
    setArea("");
    setVisibleTo("all");
    setDescription("");
    setProblem(null);
  }

  const ready = Boolean(fileId && title.trim() && type && area);

  async function onSave() {
    if (!fileId || !title.trim() || !type || !area) return;
    setProblem(null);
    try {
      await create.mutateAsync({
        title: title.trim(),
        type,
        area,
        visible_to: visibleTo,
        description: description.trim() || null,
        file_id: fileId,
      });
      reset();
      onSaved?.();
      onClose();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo cargar el recurso.");
    }
  }

  const types = options.data?.types ?? [];
  const areas = options.data?.areas ?? [];
  const audiences = options.data?.audiences ?? ["all"];

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          reset();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Cargar un recurso del colegio</DialogTitle>
          <DialogDescription>
            El recurso queda en la biblioteca de tu colegio y lo ve quien tú elijas. El equipo de
            Lumen no interviene.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* The file: the thing that is uploaded. */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Archivo
            </span>
            <div
              className={cn(
                "mt-1.5 rounded-idx border border-dashed p-4 text-center",
                file ? "border-primary/40 bg-primary-soft/40" : "border-input bg-card",
              )}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2 text-[13px]">
                  <FileUp className="size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
                  <span className="truncate font-medium">{file.name}</span>
                  <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
              ) : (
                <p className="text-[13px] text-muted-foreground">
                  Un PDF, un documento, un video o una imagen.
                </p>
              )}
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                accept=".pdf,.epub,.docx,.zip,.mp4,.png,.jpg,.jpeg,.webp,.gif"
                onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={upload.isPending}
                onClick={() => inputRef.current?.click()}
              >
                {upload.isPending
                  ? "Subiendo..."
                  : file
                    ? "Cambiar el archivo"
                    : "Elegir el archivo"}
              </Button>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Título
            </span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Manual de convivencia 2026"
              className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Tipo
              </span>
              <select
                value={type}
                onChange={(event) => setType(event.target.value)}
                className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
              >
                <option value="">Elige el tipo</option>
                {types.map((value) => (
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
                <option value="">Elige el área</option>
                {areas.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* The audience: the decision of the school. */}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Va dirigido a
            </span>
            <select
              value={visibleTo}
              onChange={(event) => setVisibleTo(event.target.value)}
              className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors focus:border-ring"
            >
              {audiences.map((value) => (
                <option key={value} value={value}>
                  {audienceLabel(value)}
                </option>
              ))}
            </select>
            <span className="mt-1.5 block text-xs text-muted-foreground">
              Elige a quién ve el recurso dentro de tu colegio.
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Descripción <span className="font-normal">(opcional)</span>
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              placeholder="De qué trata y cuándo se usa."
              className="mt-1.5 w-full resize-y rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring"
            />
          </label>

          {problem && (
            <p role="alert" className="text-[13px] text-destructive">
              {problem}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            icon={upload.isPending ? Upload : Check}
            disabled={!ready || create.isPending}
            onClick={() => void onSave()}
          >
            {create.isPending ? "Cargando..." : "Cargar el recurso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
