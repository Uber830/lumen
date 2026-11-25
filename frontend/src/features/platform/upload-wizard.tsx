import { AlertTriangle, Check, Link2, Upload } from "lucide-react";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/dialog";
import { StatusPill } from "@/components/ui-kit";
import {
  useCatalogOptions,
  useChangeMaterialStatus,
  useCreateMaterial,
  usePlatformSchools,
  useUploadFile,
} from "@/lib/platform/hooks";
import { cn } from "@/lib/utils";

/**
 * The upload assistant, in three steps.
 *
 *   1. the origin: a file from this machine or a link to a resource
 *      that is already published somewhere else;
 *   2. the metadata and the schools that will have access;
 *   3. the review, where the material is published.
 *
 * The closed catalogs (types, areas, grades) come from the API: the
 * assistant never offers a value the backend would refuse.
 */
const STEPS = ["Origen del archivo", "Metadatos y acceso", "Revisión y publicación"];

export function UploadWizard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const options = useCatalogOptions();
  const schools = usePlatformSchools({ per_page: 50 });
  const upload = useUploadFile();
  const create = useCreateMaterial();
  const changeStatus = useChangeMaterialStatus();

  const [step, setStep] = useState(1);
  const [origin, setOrigin] = useState<"upload" | "link">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [area, setArea] = useState("");
  const [grades, setGrades] = useState<string[]>([]);
  const [visibleTo, setVisibleTo] = useState("all");
  const [description, setDescription] = useState("");
  const [selectedSchools, setSelectedSchools] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // The assistant starts from scratch every time it is opened: the
  // parent remounts it with a key, so no effect is needed to clean the
  // state of the previous run.

  async function onPickFile(picked: File | null) {
    if (!picked) return;
    setFile(picked);
    setProblem(null);
    // The name of the file proposes the title; the user can change it.
    setTitle(picked.name.replace(/\.[^.]+$/, ""));
    try {
      const result = await upload.mutateAsync(picked);
      setFileId(result.file_id);
      if (result.duplicate_of) {
        setProblem(
          `Este archivo ya existe en el catálogo como ${result.duplicate_of.code}. Puedes continuar, pero quedará como un material nuevo.`,
        );
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo subir el archivo.");
    }
  }

  function toggleGrade(grade: string) {
    setGrades((current) =>
      current.includes(grade) ? current.filter((value) => value !== grade) : [...current, grade],
    );
  }

  function toggleSchool(schoolId: string) {
    setSelectedSchools((current) =>
      current.includes(schoolId)
        ? current.filter((value) => value !== schoolId)
        : [...current, schoolId],
    );
  }

  // The step 2 cannot be left without the fields the backend asks for.
  const metadataReady = Boolean(title.trim() && type && area);
  const canContinue =
    step === 1 ? (origin === "upload" ? Boolean(fileId) : externalUrl) : metadataReady;
  // The backend only publishes a piece with title, type, area, grades
  // and at least one school: the assistant asks for the same.
  const canPublish = metadataReady && grades.length > 0 && selectedSchools.length > 0;

  async function publish() {
    setProblem(null);
    try {
      const material = await create.mutateAsync({
        title: title.trim(),
        type,
        area,
        grades,
        visible_to: visibleTo,
        description: description.trim() || null,
        origin,
        external_url: origin === "link" ? externalUrl.trim() : null,
        school_ids: selectedSchools,
        file_id: origin === "upload" ? fileId : null,
      });
      // The material is born as a draft: publishing it is another call,
      // so the history says when it happened.
      await changeStatus.mutateAsync({ id: material.id, status: "published" });
      onClose();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "No se pudo crear el material.");
    }
  }

  const schoolName = (id: string) =>
    (schools.data?.items ?? []).find((school) => school.id === id)?.name ?? id;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cargar contenido</DialogTitle>
          <DialogDescription>
            Material de la editorial. Al publicar, queda disponible para los colegios que elijas.
          </DialogDescription>
        </DialogHeader>

        <ol className="grid grid-cols-3 gap-2 px-1">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const state = step === number ? "on" : step > number ? "done" : "";
            return (
              <li key={label}>
                <span
                  className={cn(
                    "mb-1.5 block h-0.5 rounded-full",
                    step > number ? "bg-success" : step === number ? "bg-primary" : "bg-muted",
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "block text-[11.5px]",
                    step === number ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  {number}. {label}
                </span>
              </li>
            );
          })}
        </ol>

        {problem && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.9} aria-hidden />
            {problem}
          </p>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  value: "upload" as const,
                  icon: Upload,
                  label: "Subir archivos",
                  hint: "PDF, EPUB, DOCX, MP4 o ZIP",
                },
                {
                  value: "link" as const,
                  icon: Link2,
                  label: "Enlazar contenido externo",
                  hint: "URL de un recurso ya publicado",
                },
              ].map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  onClick={() => setOrigin(choice.value)}
                  aria-pressed={origin === choice.value}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-colors",
                    origin === choice.value
                      ? "border-primary bg-primary-soft"
                      : "border-border hover:border-line-2",
                  )}
                >
                  <choice.icon
                    className={cn(
                      "mb-2 size-5",
                      origin === choice.value ? "text-primary" : "text-muted-foreground",
                    )}
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  <span className="block text-sm font-semibold">{choice.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{choice.hint}</span>
                </button>
              ))}
            </div>

            {origin === "upload" ? (
              <div>
                <input
                  ref={inputRef}
                  type="file"
                  className="sr-only"
                  onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="w-full rounded-lg border border-dashed border-line-2 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-primary-soft"
                >
                  <Upload
                    className="mx-auto mb-2 size-6 text-primary"
                    strokeWidth={1.9}
                    aria-hidden
                  />
                  <span className="block text-sm font-semibold">
                    Arrastra el archivo aquí o haz clic para buscar
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    El nombre del archivo se usa como título inicial.
                  </span>
                </button>
                {file && (
                  <p className="mt-2 flex items-center gap-2 text-sm">
                    <Check className="size-4 text-success" strokeWidth={1.9} aria-hidden />
                    {file.name}
                    <span className="text-xs text-muted-foreground">
                      {fileId ? "subido" : "subiendo…"}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">URL del recurso</span>
                  <input
                    value={externalUrl}
                    onChange={(event) => setExternalUrl(event.target.value)}
                    placeholder="https://…"
                    className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
                <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
                  El enlace no se descarga ni se respalda: si el recurso externo deja de estar
                  disponible, los docentes lo verán como no disponible.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="mb-1.5 block text-sm font-medium">Título *</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Tipo de material *</span>
                <select
                  value={type}
                  onChange={(event) => setType(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
                >
                  <option value="">Elegí un tipo</option>
                  {(options.data?.types ?? []).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Área *</span>
                <select
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
                >
                  <option value="">Elegí un área</option>
                  {(options.data?.areas ?? []).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <span className="mb-1.5 block text-sm font-medium">Grados</span>
              <div className="flex flex-wrap gap-1.5">
                {(options.data?.grades ?? []).map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    onClick={() => toggleGrade(grade)}
                    aria-pressed={grades.includes(grade)}
                    className={cn(
                      "rounded-idx px-2.5 py-1 text-xs font-medium transition-colors",
                      grades.includes(grade)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {grade}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                A qué grados aplica dentro de cada colegio. Sin grados, aplica a todo el colegio.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Visible para</span>
              <select
                value={visibleTo}
                onChange={(event) => setVisibleTo(event.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
              >
                {(options.data?.visible_to ?? ["all"]).map((value) => (
                  <option key={value} value={value}>
                    {value === "all" ? "Docentes y estudiantes" : value}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-medium">Colegios que pueden verlo *</span>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {(schools.data?.items ?? []).map((school) => {
                  const on = selectedSchools.includes(school.id);
                  return (
                    <button
                      key={school.id}
                      type="button"
                      onClick={() => toggleSchool(school.id)}
                      aria-pressed={on}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                        on ? "border-primary bg-primary-soft" : "border-border hover:border-line-2",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "grid size-4 shrink-0 place-items-center rounded border text-[10px] text-primary-foreground",
                          on ? "border-primary bg-primary" : "border-line-2",
                        )}
                      >
                        {on ? "✓" : ""}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{school.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {school.short_code} · {school.students} estudiantes
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Solo estos colegios verán el material. Puedes cambiarlo más adelante sin volver a
                cargar el archivo.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">
                Descripción para la comunidad
              </span>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                placeholder="Qué encuentra el docente o el estudiante en este material"
                className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-sm text-success">
              <Check className="mt-0.5 size-4 shrink-0" strokeWidth={1.9} aria-hidden />
              <span>
                Al publicar, el material queda disponible para {selectedSchools.length}{" "}
                {selectedSchools.length === 1 ? "colegio" : "colegios"}:{" "}
                {selectedSchools.map(schoolName).join(", ")}.
              </span>
            </p>

            <dl className="grid grid-cols-[140px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Título</dt>
              <dd>{title}</dd>
              <dt className="text-muted-foreground">Tipo</dt>
              <dd>{type}</dd>
              <dt className="text-muted-foreground">Área</dt>
              <dd>{area}</dd>
              <dt className="text-muted-foreground">Grados</dt>
              <dd>{grades.length > 0 ? grades.join(" · ") : "Todo el colegio"}</dd>
              <dt className="text-muted-foreground">Visible para</dt>
              <dd>{visibleTo === "all" ? "Docentes y estudiantes" : visibleTo}</dd>
              <dt className="text-muted-foreground">Origen</dt>
              <dd>
                {origin === "upload" ? `Carga manual · ${file?.name ?? ""}` : "Enlace externo"}
              </dd>
              <dt className="text-muted-foreground">Estado final</dt>
              <dd>
                <StatusPill label="Publicado" tone="success" />
              </dd>
            </dl>

            {!canPublish && (
              <p className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
                Falta el título, el tipo, el área, al menos un grado o al menos un colegio con
                acceso.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3.5 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <div className="flex gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((value) => value - 1)}
                className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold hover:bg-muted"
              >
                Atrás
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((value) => value + 1)}
                disabled={!canContinue}
                className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continuar
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void publish()}
                disabled={!canPublish || create.isPending}
                className="rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {create.isPending ? "Publicando…" : "Publicar en el catálogo"}
              </button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
