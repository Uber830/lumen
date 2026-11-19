import { useRouteContext, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarRange, Plus, Trash2 } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { ConfirmDialog, useDeleteConfirmation } from "@/components/confirm-dialog";
import { StatusBadge, toneForEstado } from "@/components/status-badge";
import {
  useAcademicPeriods,
  useCreateAcademicPeriod,
  useDeleteAcademicPeriod,
  useUpdateAcademicPeriod,
} from "@/features/academics/hooks";

export const Route = createFileRoute("/admin/periodos")({
  head: () => ({
    meta: [
      { title: "Períodos académicos — Lumen" },
      {
        name: "description",
        content: "Configurá bimestres, trimestres o semestres con fechas de inicio y fin.",
      },
      { property: "og:title", content: "Períodos académicos — Lumen" },
      {
        property: "og:description",
        content: "Calendario académico configurable por institución.",
      },
    ],
  }),
  component: PeriodosPage,
});

const MODALITIES = [
  { id: "bimestre", label: "Bimestres" },
  { id: "trimestre", label: "Trimestres" },
  { id: "semestre", label: "Semestres" },
  { id: "anual", label: "Anual" },
] as const;

/**
 * The API answers in English; the page speaks Spanish.
 *
 * The duplicate name is the one the admin hits most: the name has to be
 * unique inside the school, and the raw message does not say that.
 */
function periodErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (/already exists/i.test(raw)) {
    return "Ya existe un período con ese nombre. Usá un nombre distinto (por ejemplo, 2do Trimestre).";
  }
  return raw || "No se pudo crear el período.";
}

function PeriodosPage() {
  const { session } = useRouteContext({ from: "/admin/periodos" });
  const schoolId = session.primarySchoolId;

  const periods = useAcademicPeriods(schoolId);
  const create = useCreateAcademicPeriod(schoolId ?? "");
  const update = useUpdateAcademicPeriod(schoolId ?? "");
  const remove = useDeleteAcademicPeriod(schoolId ?? "");

  const [name, setName] = useState("");
  const [modality, setModality] = useState<"bimestre" | "trimestre" | "semestre" | "anual">(
    "trimestre",
  );
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);

  // The deletion asks for confirmation with the shared modal.
  const periodToDelete = useDeleteConfirmation();

  if (!schoolId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio todavía.
        </p>
      </div>
    );
  }

  async function onCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !start || !end) return;
    if (start > end) {
      // Say it instead of failing silently: the admin would think the
      // button is broken.
      setDateError("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }
    setDateError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        modality,
        start_date: start,
        end_date: end,
        is_current: false,
      });
      setName("");
      setStart("");
      setEnd("");
    } catch {
      // The error is shown below the form, in Spanish.
    }
  }

  async function onMarkCurrent(id: string, isCurrent: boolean) {
    if (isCurrent) return;
    await update.mutateAsync({ id, patch: { is_current: true } });
  }

  return (
    <>
      <PageHeader
        title="Períodos académicos"
        subtitle={`Ciclo lectivo · ${periods.data?.length ?? 0} períodos configurados`}
        actions={<CalendarRange className="size-5 text-muted-foreground" aria-hidden />}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard title="Nuevo período" className="lg:col-span-1">
          <form className="space-y-3" onSubmit={onCreate}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="1er Trimestre 2026"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                El nombre tiene que ser distinto en cada período. Podés crear todos los que
                necesites.
              </p>
            </label>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modalidad
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {MODALITIES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModality(m.id)}
                    className={
                      modality === m.id
                        ? "rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground"
                        : "rounded-lg border border-border px-3.5 py-1.5 text-xs font-semibold hover:bg-muted"
                    }
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Inicio
                </span>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Fin
                </span>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                  className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="size-4" />
              {create.isPending ? "Creando..." : "Crear período"}
            </button>
            {dateError && (
              <p role="alert" className="text-sm text-destructive">
                {dateError}
              </p>
            )}
            {create.error && (
              <p role="alert" className="text-sm text-destructive">
                {periodErrorMessage(create.error)}
              </p>
            )}
          </form>
        </SectionCard>

        <SectionCard title="Períodos configurados" className="lg:col-span-2" bodyClassName="p-0">
          {periods.isLoading ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Cargando períodos...</p>
          ) : periods.error ? (
            <p role="alert" className="px-5 py-6 text-sm text-destructive">
              {periods.error.message}
            </p>
          ) : periods.data && periods.data.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Crea el primer período con el formulario de la izquierda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {periods.data?.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.start_date} → {p.end_date} · {p.modality}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone={toneForEstado(p.is_current ? "Activo" : "Pendiente")}>
                      {p.is_current ? "Vigente" : "No vigente"}
                    </StatusBadge>
                    <button
                      type="button"
                      onClick={() => onMarkCurrent(p.id, p.is_current)}
                      disabled={p.is_current || update.isPending}
                      className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Marcar vigente
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        periodToDelete.ask({
                          id: p.id,
                          title: `el período "${p.name}"`,
                          description:
                            "Se borran también las notas registradas en este período. Esta acción no se puede deshacer.",
                        })
                      }
                      disabled={remove.isPending}
                      className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Eliminar ${p.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={periodToDelete.target !== null}
        title={`Eliminar ${periodToDelete.target?.title ?? ""}`}
        description={periodToDelete.target?.description}
        pending={remove.isPending}
        onCancel={periodToDelete.close}
        onConfirm={() => {
          const id = periodToDelete.target?.id;
          if (!id) return;
          remove.mutate(id, { onSuccess: periodToDelete.close });
        }}
      />
    </>
  );
}
