import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { CalendarRange, Lock, Plus, X } from "lucide-react";
import { useState } from "react";

import {
  Button,
  PanelTable,
  Chip,
  EmptyState,
  PageHeader,
  SectionCard,
  TableShell,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useCreateAcademicPeriod } from "@/features/academics/hooks";
import {
  useClosePeriod,
  useSchoolPeriods,
  useSetCurrentPeriod,
  type SchoolPeriod,
} from "@/lib/school/cycles";

export const Route = createFileRoute("/admin/periodos")({
  head: () => ({
    meta: [
      { title: "Períodos académicos — Lumen" },
      {
        name: "description",
        content: "Ciclo lectivo y modalidad. El contenido se archiva al cerrar un periodo.",
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
    return "Ya existe un período con ese nombre. Usa un nombre distinto (por ejemplo, 2do Trimestre).";
  }
  return raw || "No se pudo crear el período.";
}

/** The date, the way the panel writes them: 14/11/2026. */
function shortDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function PeriodosPage() {
  const { session } = useRouteContext({ from: "/admin/periodos" });
  const schoolId = session.primarySchoolId;

  const periods = useSchoolPeriods();
  const close = useClosePeriod();
  const setCurrent = useSetCurrentPeriod();
  const create = useCreateAcademicPeriod(schoolId ?? "");

  const [name, setName] = useState("");
  const [modality, setModality] = useState<"bimestre" | "trimestre" | "semestre" | "anual">(
    "trimestre",
  );
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [dateError, setDateError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // The period the admin is about to close.
  const [toClose, setToClose] = useState<SchoolPeriod | null>(null);

  // The frontend does not decide what the rank may do: it receives the
  // list from the API. A closed action is disabled **with the reason**,
  // not invisible.
  const canClose = session.permissions.includes("periods.close");
  const current = (periods.data ?? []).find((period) => period.status === "vigente") ?? null;

  // The reason of a control that does not work is read by the screen
  // reader, not only by the mouse that rests on it.
  const closeReason = !canClose
    ? "Cerrar un periodo lo hace el administrador principal del colegio."
    : !current
      ? "No hay un periodo vigente que cerrar."
      : "";
  const currentReason = (period: SchoolPeriod) =>
    !canClose
      ? "Marcar un periodo vigente lo hace el administrador principal del colegio."
      : period.status === "vigente"
        ? "Este periodo ya es el vigente."
        : "";

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
      setFormOpen(false);
    } catch {
      // The error is shown below the form, in Spanish.
    }
  }

  return (
    <>
      <PageHeader
        title="Períodos académicos"
        subtitle="Ciclo lectivo y modalidad. El contenido se archiva al cerrar un periodo."
        actions={
          <>
            <Button
              variant="outline"
              icon={Lock}
              aria-disabled={!canClose || !current}
              aria-describedby={closeReason ? "periodos-close-reason" : undefined}
              title={
                canClose
                  ? current
                    ? "Cerrar el periodo vigente"
                    : "No hay un periodo vigente que cerrar"
                  : "Esta acción la hace el administrador principal del colegio."
              }
              onClick={() => {
                if (!canClose || !current) return;
                setToClose(current);
              }}
            >
              Cerrar periodo
            </Button>
            <Button icon={Plus} onClick={() => setFormOpen((open) => !open)}>
              Nuevo periodo
            </Button>
          </>
        }
      />

      {/* The current period is permanent context: it says where the
          school is, and it is the one the close acts on. */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Chip tone="teal" dot>
          {periods.isLoading
            ? "Buscando el periodo vigente..."
            : current
              ? `Vigente: ${current.name}`
              : "Sin periodo vigente"}
        </Chip>
        {current && !periods.isLoading && (
          <span className="text-[12.4px] text-muted-foreground">
            {shortDate(current.start_date)} — {shortDate(current.end_date)} ·{" "}
            {current.delivery_modality ?? current.modality}
          </span>
        )}
        {!canClose && (
          <span className="text-[12.4px] text-muted-foreground">
            El cierre de periodos es del administrador principal.
          </span>
        )}
      </div>

      {closeReason && (
        <p id="periodos-close-reason" className="sr-only">
          {closeReason}
        </p>
      )}

      {formOpen && (
        <SectionCard className="mb-4" title="Nuevo periodo" bodyClassName="p-0">
          <form className="space-y-3 p-4" onSubmit={onCreate}>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nombre
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="4to Trimestre 2026"
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Modalidad
              </span>
              <select
                value={modality}
                onChange={(e) =>
                  setModality(e.target.value as "bimestre" | "trimestre" | "semestre" | "anual")
                }
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              >
                {MODALITIES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
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
            {dateError && (
              <p role="alert" className="text-[13px] text-destructive">
                {dateError}
              </p>
            )}
            {create.error && (
              <p role="alert" className="text-[13px] text-destructive">
                {periodErrorMessage(create.error)}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button type="submit" icon={CalendarRange} disabled={create.isPending}>
                {create.isPending ? "Creando..." : "Crear periodo"}
              </Button>
              <Button
                variant="ghost"
                icon={X}
                onClick={() => {
                  setFormOpen(false);
                  setDateError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        {periods.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {periods.error.message}
          </p>
        ) : periods.isLoading ? (
          <div className="px-[18px] py-4" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-4 py-[11px]">
                <span className="h-[11px] w-[150px] animate-pulse rounded bg-muted" />
                <span className="h-[11px] w-[90px] animate-pulse rounded bg-muted" />
                <span className="h-[11px] w-[90px] animate-pulse rounded bg-muted" />
                <span className="h-[18px] w-[70px] animate-pulse rounded-full bg-muted" />
              </div>
            ))}
          </div>
        ) : (periods.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="Sin periodos"
            description="Crea el primer periodo académico del colegio para poder trabajar con notas y material."
            action={
              <Button icon={Plus} onClick={() => setFormOpen(true)}>
                Nuevo periodo
              </Button>
            }
          />
        ) : (
          <TableShell>
            <PanelTable className="w-full border-collapse">
              <caption className="sr-only">
                Periodos académicos del colegio, con su modalidad y su estado
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={tableHeadClass}>
                    Periodo
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Inicio
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Fin
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Modalidad
                  </th>
                  <th scope="col" className={tableHeadClass}>
                    Estado
                  </th>
                  <th scope="col" className={`${tableHeadClass} text-right`}>
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {(periods.data ?? []).map((period) => (
                  <tr key={period.id} className="transition-colors hover:bg-muted">
                    <td className={`${tableCellClass} font-medium text-foreground`}>
                      {period.name}
                    </td>
                    <td className={`${tableCellClass} font-mono text-[12.4px] text-foreground`}>
                      {shortDate(period.start_date)}
                    </td>
                    <td className={`${tableCellClass} font-mono text-[12.4px] text-foreground`}>
                      {shortDate(period.end_date)}
                    </td>
                    <td className={tableCellClass}>
                      {period.delivery_modality ?? period.modality}
                    </td>
                    <td className={tableCellClass}>
                      <Chip
                        tone={
                          period.status === "vigente"
                            ? "ok"
                            : period.status === "future"
                              ? "info"
                              : "muted"
                        }
                        dot
                      >
                        {period.status === "vigente"
                          ? "Vigente"
                          : period.status === "future"
                            ? "Por iniciar"
                            : "Cerrado"}
                      </Chip>
                    </td>
                    <td className={`${tableCellClass} text-right`}>
                      {currentReason(period) && (
                        <span id={`periodos-current-${period.id}`} className="sr-only">
                          {currentReason(period)}
                        </span>
                      )}
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-disabled={!canClose || period.status === "vigente"}
                          aria-describedby={
                            currentReason(period) ? `periodos-current-${period.id}` : undefined
                          }
                          title={
                            canClose
                              ? period.status === "vigente"
                                ? "Este periodo ya es el vigente"
                                : "Marcar este periodo como vigente"
                              : "Esta acción la hace el administrador principal del colegio."
                          }
                          onClick={() => {
                            if (!canClose || period.status === "vigente") return;
                            setCurrent.mutate(period.id);
                          }}
                        >
                          Marcar vigente
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PanelTable>
          </TableShell>
        )}
        {(close.error || setCurrent.error) && (
          <p role="alert" className="px-[18px] py-4 text-[13px] text-destructive">
            {(close.error ?? setCurrent.error)?.message}
          </p>
        )}
      </SectionCard>

      {/* The foot of the view: the state of the system, so that a page
          is never a blank rectangle. */}
      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>
          Al cerrar un periodo, el material de ese ciclo se archiva para el colegio: queda en el
          histórico y sale del material activo.
        </span>
      </p>

      <ConfirmDialog
        open={toClose !== null}
        title={toClose ? `Cerrar ${toClose.name}` : "Cerrar periodo"}
        description={
          toClose ? (
            <>
              Se cerrará <strong className="font-semibold text-foreground">{toClose.name}</strong>.
              El material del ciclo pasa a archivado y deja de estar visible para docentes y
              estudiantes.
            </>
          ) : undefined
        }
        confirmLabel="Cerrar periodo"
        pending={close.isPending}
        onCancel={() => setToClose(null)}
        onConfirm={() => {
          if (!toClose) return;
          close.mutate(toClose.id, { onSuccess: () => setToClose(null) });
        }}
      />
    </>
  );
}
