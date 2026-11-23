import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { Check, Image, Info, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { Button, Chip, PageHeader, SectionCard } from "@/components/ui-kit";
import {
  COLOR_SAMPLES,
  useSchoolIdentity,
  useUpdateSchoolIdentity,
  useUploadSchoolLogo,
} from "@/lib/school/identity";
import { applyPrimaryColor } from "@/lib/school/theme";
import { fileUrl } from "@/lib/storage/files";

export const Route = createFileRoute("/admin/personalizacion")({
  head: () => ({
    meta: [
      { title: "Personalización — Lumen" },
      {
        name: "description",
        content: "Identidad visible del colegio. El contenido lo carga el equipo de plataforma.",
      },
      { property: "og:title", content: "Personalización — Lumen" },
      {
        property: "og:description",
        content: "Tu marca institucional aplicada a toda la plataforma.",
      },
    ],
  }),
  component: Personalizacion,
});

/** The shield: PNG, SVG or JPEG, and no more than 2 MB. */
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/svg+xml", "image/jpeg"];

function Personalizacion() {
  const { session } = useRouteContext({ from: "/admin" });
  const identity = useSchoolIdentity();
  const updateIdentity = useUpdateSchoolIdentity();
  const uploadLogo = useUploadSchoolLogo();

  const [displayName, setDisplayName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  // The preview of the file that was just chosen: it is shown before
  // the upload finishes, so the person sees the shield they picked.
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // Changing the identity is the principal's. The action is disabled
  // **with the reason**, not invisible.
  const canEdit = session.permissions.includes("customization.write");

  if (identity.isError) {
    return (
      <>
        <PageHeader title="Personalización" subtitle="Identidad visible del colegio" />
        <p role="alert" className="text-[13px] text-destructive">
          {identity.error.message}
        </p>
      </>
    );
  }

  const data = identity.data;
  const effectiveName = displayName ?? data?.display_name ?? "";
  const effectiveColor = color ?? data?.primary_color ?? COLOR_SAMPLES[0].value;
  const currentLogo = logoPreview ?? fileUrl(data?.logo_url);
  const currentLogoName = logoName ?? (data?.logo_url ? "escudo actual" : null);
  // The contrast the backend calculated for the saved colour. The
  // colour that is being picked has no ratio until it is saved: the
  // backend is the one that calculates it.
  const contrast = data?.contrast ?? null;

  async function onSave() {
    setErrorMsg(null);
    setSaved(false);
    try {
      await updateIdentity.mutateAsync({
        display_name: effectiveName.trim(),
        primary_color: effectiveColor,
      });
      // The colour reaches the panel right away, without a reload.
      applyPrimaryColor(effectiveColor);
      setSaved(true);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "No se pudieron guardar los cambios.");
    }
  }

  async function onPickLogo(file: File) {
    setErrorMsg(null);
    setSaved(false);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMsg("El escudo debe ser un archivo PNG, SVG o JPEG.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setErrorMsg("El escudo pesa más de 2 MB. Elige uno más liviano.");
      return;
    }

    // The preview of the file that was chosen, shown right away.
    const preview = await readAsDataUrl(file);
    setLogoPreview(preview);
    setLogoName(file.name);

    try {
      await uploadLogo.mutateAsync(file);
      setSaved(true);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "No se pudo subir el escudo.");
    }
  }

  return (
    <>
      <PageHeader
        title="Personalización"
        subtitle="Identidad visible del colegio. El contenido lo carga el equipo de plataforma."
        actions={
          <Button
            disabled={updateIdentity.isPending || identity.isLoading}
            onClick={() => {
              if (!canEdit) return;
              onSave();
            }}
            aria-disabled={!canEdit}
            aria-describedby={canEdit ? undefined : "identity-write-reason"}
            title={
              canEdit
                ? "Guardar el nombre y el color"
                : "Esta acción la hace el administrador principal del colegio."
            }
          >
            {updateIdentity.isPending ? "Guardando..." : "Guardar cambios"}
          </Button>
        }
      />

      {!canEdit && (
        <p
          id="identity-write-reason"
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 text-[13px] text-muted-foreground"
        >
          La identidad del colegio la cambia el administrador principal. Puedes verla, pero no
          modificarla.
        </p>
      )}

      {errorMsg && (
        <p
          role="alert"
          className="mb-4 rounded-xl border border-[rgba(240,93,94,.3)] bg-destructive-soft px-4 py-3 text-[13px] text-destructive"
        >
          {errorMsg}
        </p>
      )}
      {saved && !errorMsg && (
        <p role="status" className="mb-4 text-[13px] text-success">
          Cambios guardados.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SectionCard title="Identidad" description="El nombre y el escudo que ve la comunidad">
          <div className="space-y-5">
            <label className="block">
              <span className="text-[12.4px] font-medium text-foreground">Nombre visible</span>
              <input
                type="text"
                value={effectiveName}
                disabled={!canEdit}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Colegio Sagrado Corazón"
                aria-describedby="display-name-help"
                className="mt-1.5 w-full rounded-idx border border-input bg-card px-3 py-2 text-[13px] outline-none transition-colors placeholder:text-muted-foreground focus:border-ring disabled:opacity-60"
              />
              <p id="display-name-help" className="mt-1.5 text-[12px] text-muted-foreground">
                Aparece en la barra lateral y los encabezados. Si lo dejas vacío se usa "Colegio
                Demo".
              </p>
            </label>

            <div>
              <span className="text-[12.4px] font-medium text-foreground">Escudo</span>
              <div className="mt-1.5 flex items-center gap-3.5 rounded-idx border border-dashed border-input bg-secondary px-4 py-3.5">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-idx bg-card">
                  {currentLogo ? (
                    <img
                      src={currentLogo}
                      alt="Escudo del colegio"
                      className="size-10 object-cover"
                      width={40}
                      height={40}
                    />
                  ) : (
                    <Image className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {currentLogoName ?? "Sin escudo"}
                  </p>
                  <p className="text-[12px] text-muted-foreground">
                    PNG o SVG · máximo 2 MB
                    {currentLogoName && currentLogoName !== "escudo actual"
                      ? ` · ${(uploadLogo.variables?.size ? uploadLogo.variables.size / 1024 : 0).toFixed(0)} KB`
                      : ""}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Upload}
                  aria-disabled={!canEdit}
                  aria-describedby={canEdit ? undefined : "identity-write-reason"}
                  onClick={() => {
                    if (!canEdit) return;
                    fileRef.current?.click();
                  }}
                >
                  Cambiar
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/svg+xml,image/jpeg"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onPickLogo(file);
                    // The same file can be chosen again after a change.
                    event.target.value = "";
                  }}
                />
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Color primario" description="El color de los botones y de los acentos">
          <div className="flex flex-wrap gap-2.5">
            {COLOR_SAMPLES.map((sample) => {
              const selected = effectiveColor.toUpperCase() === sample.value.toUpperCase();
              return (
                <button
                  key={sample.value}
                  type="button"
                  aria-disabled={!canEdit}
                  aria-describedby={canEdit ? undefined : "identity-write-reason"}
                  onClick={() => {
                    if (!canEdit) return;
                    setColor(sample.value);
                  }}
                  aria-pressed={selected}
                  aria-label={`${sample.name} ${sample.value}`}
                  title={`${sample.name} · ${sample.value}`}
                  className="flex items-center gap-2 rounded-idx border border-border bg-secondary px-3 py-2 text-[12.4px] text-muted-foreground transition-colors hover:border-input disabled:opacity-60"
                  style={
                    selected ? { borderColor: sample.value, color: "var(--foreground)" } : undefined
                  }
                >
                  <span
                    className="size-5 rounded-full border border-white/15"
                    style={{ backgroundColor: sample.value }}
                    aria-hidden
                  />
                  {sample.name}
                  {selected && <Check className="size-3.5" strokeWidth={2.2} aria-hidden />}
                </button>
              );
            })}
          </div>

          {contrast ? (
            <p className="mt-4 flex items-start gap-2.5 rounded-xl border border-success/30 bg-success-soft p-3 text-[12.5px] text-foreground">
              <Info className="mt-px size-4 shrink-0 text-success" strokeWidth={1.9} aria-hidden />
              <span>
                <b className="font-semibold text-foreground">Contraste verificado.</b>
                <br />
                Con el color seleccionado, tus textos y botones mantienen una relación de contraste
                de <b className="font-semibold text-foreground">{contrast.min_ratio}:1</b> sobre el
                fondo oscuro (se requieren {contrast.minimum}:1 o más).
              </span>
            </p>
          ) : (
            <p className="mt-4 text-[12.5px] text-muted-foreground">
              Guarda el color para ver la relación de contraste que el servidor calcula.
            </p>
          )}
        </SectionCard>
      </div>

      <div className="mt-4">
        <SectionCard
          title="Vista previa"
          description="Así se ve la barra lateral del colegio con los cambios"
        >
          <div className="flex items-center gap-3 rounded-idx border border-border bg-secondary px-4 py-4">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-idx bg-card">
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt="Escudo del colegio"
                  className="size-10 object-cover"
                  width={40}
                  height={40}
                />
              ) : (
                <Image className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
              )}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-foreground">
                {effectiveName || "Colegio Demo"}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">Administrador de colegio</p>
            </div>
            <span
              className="ml-auto rounded-full px-3 py-1 text-[11.8px] font-medium text-white"
              style={{ backgroundColor: effectiveColor }}
            >
              Color primario
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
            <Chip tone="muted" dot>
              Sistema operativo
            </Chip>
            <span>
              El escudo se sube de verdad: el archivo que eliges se guarda en el almacenamiento y
              aparece en toda la plataforma.
            </span>
          </div>
        </SectionCard>
      </div>
    </>
  );
}

/** The file as a data URL, so the preview is the real image. */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}
