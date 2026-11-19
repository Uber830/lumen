import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { GraduationCap, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { LogoUploadError, uploadSchoolLogo, useSchool, useUpdateSchool } from "@/lib/school/hooks";
import { applyPrimaryColor } from "@/lib/school/theme";

export const Route = createFileRoute("/admin/personalizacion")({
  head: () => ({
    meta: [
      { title: "Personalización — Lumen" },
      {
        name: "description",
        content: "Configurá el nombre, el escudo y el color de tu colegio.",
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

const palette = [
  { name: "Índigo", value: "oklch(0.52 0.19 268)" },
  { name: "Azul", value: "oklch(0.55 0.16 240)" },
  { name: "Verde", value: "oklch(0.55 0.14 155)" },
  { name: "Bordó", value: "oklch(0.5 0.16 20)" },
  { name: "Petróleo", value: "oklch(0.5 0.1 200)" },
];

type SaveStatus = "idle" | "saving" | "saved" | "error";

function Personalizacion() {
  const { session } = useRouteContext({ from: "/admin" });
  const schoolId = session.primarySchoolId;
  const school = useSchool(schoolId);
  const updateSchool = useUpdateSchool(schoolId);

  // Controlled form state, seeded once from the loaded school.
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [logoBusting, setLogoBusting] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  if (!schoolId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio.
        </p>
      </div>
    );
  }

  if (school.isLoading) {
    return (
      <>
        <PageHeader title="Personalización" subtitle="Marca institucional" />
        <p className="text-sm text-muted-foreground">Cargando...</p>
      </>
    );
  }
  if (school.error || !school.data) {
    return (
      <>
        <PageHeader title="Personalización" subtitle="Marca institucional" />
        <p role="alert" className="text-sm text-destructive">
          {school.error?.message ?? "No se pudo cargar el colegio."}
        </p>
      </>
    );
  }

  const data = school.data;
  // The effective values: the user's edits win, otherwise the server value.
  const effectiveName = displayName ?? data.display_name ?? "";
  const effectiveColor = color ?? data.primary_color ?? palette[0].value;
  const logoUrl = logoBusting ?? data.logo_url;

  async function onSave() {
    if (saveStatus === "saving") return;
    setSaveStatus("saving");
    setErrorMsg(null);
    try {
      await updateSchool.mutateAsync({
        display_name: effectiveName.trim() || null,
        primary_color: effectiveColor,
      });
      // Apply the colour to the live theme right away.
      applyPrimaryColor(effectiveColor);
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
      setSaveStatus("error");
    }
  }

  async function onPickLogo(file: File) {
    setErrorMsg(null);
    setSaveStatus("saving");
    try {
      const updated = await uploadSchoolLogo(file);
      // Bust the cache so the new logo shows immediately.
      setLogoBusting(updated.logo_url);
      school.refetch();
      setSaveStatus("saved");
      window.setTimeout(() => setSaveStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      setErrorMsg(
        err instanceof LogoUploadError
          ? err.message
          : err instanceof Error
            ? err.message
            : "No se pudo subir el logo.",
      );
      setSaveStatus("error");
    }
  }

  return (
    <>
      <PageHeader
        title="Personalización"
        subtitle="Marca institucional visible para docentes y estudiantes"
        actions={
          <button
            type="button"
            onClick={onSave}
            disabled={saveStatus === "saving"}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveStatus === "saving" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {saveStatus === "saving" ? "Guardando..." : "Guardar cambios"}
          </button>
        }
      />

      {errorMsg && (
        <p role="alert" className="text-sm text-destructive">
          {errorMsg}
        </p>
      )}
      {saveStatus === "saved" && <p className="text-sm text-success">Cambios guardados.</p>}

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Identidad" className="lg:col-start-1 lg:row-start-1">
          <div>
            <label htmlFor="display-name" className="text-sm font-medium">
              Nombre visible
            </label>
            <input
              id="display-name"
              value={effectiveName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={data.name}
              className="mt-1.5 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Se muestra en la barra lateral y los encabezados. Si lo dejás vacío, se usa “
              {data.name}”.
            </p>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium">Logo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              className="hidden"
              aria-label="Subir logo del colegio"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPickLogo(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 px-4 py-8 text-center hover:bg-muted"
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo del colegio"
                  className="max-h-20 max-w-[12rem] object-contain"
                />
              ) : (
                <>
                  <Upload className="size-6 text-muted-foreground" strokeWidth={1.75} />
                  <p className="mt-2 text-sm font-medium">Subí el logo del colegio</p>
                </>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                PNG, JPG o SVG, hasta 5 MB · {logoUrl ? "Tocá para cambiarlo" : ""}
              </p>
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              El logo aparece en la barra lateral de toda la plataforma.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Color primario"
          description="Se aplica a botones, enlaces y estados activos"
          className="lg:col-start-2 lg:row-start-1"
        >
          <div className="flex flex-wrap gap-3">
            {palette.map((c) => {
              const selected = effectiveColor === c.value;
              return (
                <button
                  key={c.name}
                  type="button"
                  aria-label={c.name}
                  aria-pressed={selected}
                  onClick={() => setColor(c.value)}
                  className={
                    selected
                      ? "size-12 rounded-xl ring-2 ring-offset-2 ring-offset-background"
                      : "size-12 rounded-xl border border-border"
                  }
                  style={{
                    backgroundColor: c.value,
                    ...(selected ? { ["--tw-ring-color" as string]: c.value } : {}),
                  }}
                />
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vista previa
            </p>
            <div className="mt-3 flex items-center gap-3">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo del colegio"
                  className="size-10 shrink-0 rounded-xl bg-card object-contain p-0.5 ring-1 ring-border"
                />
              ) : (
                <span
                  className="grid size-10 place-items-center rounded-xl text-white"
                  style={{ backgroundColor: effectiveColor }}
                >
                  <GraduationCap className="size-5" strokeWidth={1.75} />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{effectiveName || data.name}</p>
                <p className="truncate text-xs text-muted-foreground">Lumen · {data.short_code}</p>
              </div>
            </div>
            <button
              type="button"
              className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: effectiveColor }}
            >
              Botón primario
            </button>
          </div>
        </SectionCard>

        <SectionCard
          title="Responsabilidades"
          description="Qué decide el colegio y qué decide Lumen"
          className="lg:col-span-2"
        >
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold">Identidad y color: con el colegio</p>
              <p className="mt-1 text-xs text-muted-foreground">
                El nombre, el escudo y el color los define la institución.
              </p>
            </li>
            <li className="rounded-xl border border-border p-4">
              <p className="text-sm font-semibold">Material: con el equipo de plataforma</p>
              <p className="mt-1 text-xs text-muted-foreground">
                El material lo carga el equipo de Lumen y cada colegio ve solo lo que se le
                habilita.
              </p>
            </li>
          </ul>
        </SectionCard>
      </div>
    </>
  );
}
