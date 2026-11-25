import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { BarChart3, CheckCircle2, Info, Target, X } from "lucide-react";
import { useState } from "react";

import {
  Button,
  PanelTable,
  Chip,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  TableShell,
  tableCellClass,
  tableHeadClass,
} from "@/components/ui-kit";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useSchoolCourses } from "@/lib/school/community";
import {
  useActivateSimulator,
  useSchoolSimulators,
  useSimulatorResults,
  type GradeAverage,
  type SchoolSimulator,
} from "@/lib/school/icfes";

export const Route = createFileRoute("/admin/icfes-colegio")({
  head: () => ({
    meta: [
      { title: "ICFES — Lumen" },
      {
        name: "description",
        content:
          "Simulacros que el equipo de Lumen habilitó para tu colegio. Tú decides en qué cursos se activan y hasta cuándo.",
      },
      { property: "og:title", content: "ICFES — Lumen" },
      {
        property: "og:description",
        content: "Simulacros habilitados para tu colegio y sus resultados.",
      },
    ],
  }),
  component: IcfesColegioPage,
});

/** The date, the way the panel writes them: 14/11/2026. */
function shortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

/** The state of a simulator, in the words of the panel. */
function statusLabel(status: string): string {
  if (status === "publicado") return "Publicado";
  if (status === "en_curso") return "En curso";
  if (status === "cerrado") return "Cerrado";
  return status;
}

/**
 * The simulators of the school are not shown yet.
 *
 * The module is still being tuned, so the panel says so instead of
 * showing data that is not final. The list below is the one that will
 * come back when the flag is turned on.
 */
const SIMULADORES_VISIBLES = false;

function IcfesColegioPage() {
  if (!SIMULADORES_VISIBLES) return <IcfesProximamente />;
  return <SimuladoresDeLaEscuela />;
}

/** The notice that replaces the list while the module is being tuned. */
function IcfesProximamente() {
  return (
    <>
      <PageHeader
        title="ICFES"
        subtitle="Los simulacros Saber del colegio están en camino: el equipo de Lumen los está preparando."
      />

      <SectionCard className="overflow-hidden" bodyClassName="p-0">
        <div className="flex flex-col items-center gap-3 px-[18px] py-14 text-center">
          <span className="grid size-12 place-items-center rounded-idx border border-border bg-secondary">
            <Target className="size-6 text-primary" strokeWidth={1.8} aria-hidden />
          </span>
          <p className="text-[15px] font-semibold text-foreground">Próximamente</p>
          <p className="max-w-md text-[13px] text-muted-foreground">
            Simulacros Saber por grado, con la activación por curso y los resultados del colegio. Te
            avisamos en cuanto estén listos.
          </p>
        </div>

        <p className="flex items-start gap-2 border-t border-border px-[18px] py-3.5 text-[12.5px] text-muted-foreground">
          <Info className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
          <span>
            Mientras tanto, el material y las tareas de tus cursos siguen en{" "}
            <strong>Contenido</strong> y en <strong>Cursos y materias</strong>.
          </span>
        </p>
      </SectionCard>
    </>
  );
}

function SimuladoresDeLaEscuela() {
  const { session } = useRouteContext({ from: "/admin" });

  const simulators = useSchoolSimulators();
  const courses = useSchoolCourses();
  const activate = useActivateSimulator();

  // The simulator the admin is about to activate, and the one whose
  // results are open.
  const [toActivate, setToActivate] = useState<SchoolSimulator | null>(null);
  const [selected, setSelected] = useState<SchoolSimulator | null>(null);
  const [courseIds, setCourseIds] = useState<string[]>([]);
  const [deadline, setDeadline] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const results = useSimulatorResults(selected?.id ?? null);

  // The frontend does not decide what the rank may do: it receives the
  // list from the API.
  const canActivate = session.permissions.includes("icfes.activate");

  const kpis = simulators.data?.kpis;
  // The averages that are shown are the grades where the school actually
  // ran a simulation; the rest complete the two cards of the row. The
  // grades come from the API: none is written down here.
  const averages = (() => {
    const byGrade = new Map((kpis?.averages_by_grade ?? []).map((item) => [item.grade, item]));
    const ordered: GradeAverage[] = [];
    for (const simulator of simulators.data?.items ?? []) {
      if (!simulator.activated) continue;
      const average = byGrade.get(simulator.grade);
      if (average && !ordered.some((item) => item.grade === average.grade)) ordered.push(average);
    }
    for (const average of byGrade.values()) {
      if (ordered.length >= 2) break;
      if (!ordered.some((item) => item.grade === average.grade)) ordered.push(average);
    }
    return ordered.slice(0, 2);
  })();

  function openActivation(simulator: SchoolSimulator) {
    setToActivate(simulator);
    setCourseIds([]);
    setDeadline("");
    setFormError(null);
  }

  async function onActivate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!toActivate) return;
    if (courseIds.length === 0) {
      setFormError("Elige al menos un curso para activar el simulacro.");
      return;
    }
    if (!deadline) {
      setFormError("Elige la fecha límite de la prueba.");
      return;
    }
    setFormError(null);
    try {
      await activate.mutateAsync({
        simulatorId: toActivate.id,
        course_ids: courseIds,
        deadline,
      });
      setToActivate(null);
    } catch {
      // The error is shown under the form, in Spanish.
    }
  }

  return (
    <>
      <PageHeader
        title="ICFES"
        subtitle="Simulacros que el equipo de Lumen habilitó para tu colegio. Tú decides en qué cursos se activan y hasta cuándo."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Simulacros disponibles"
          value={String(kpis?.available ?? 0)}
          delta={
            kpis ? (
              <>
                <b className="font-semibold text-foreground">{kpis.not_activated}</b> sin activar en
                tu colegio
              </>
            ) : undefined
          }
          icon={Target}
          tone="primary"
          loading={simulators.isLoading}
        />
        <StatCard
          label="Activados por tu colegio"
          value={String(kpis?.activated ?? 0)}
          delta={
            kpis ? (
              <>
                <b className="font-semibold text-foreground">{kpis.activated_courses}</b> cursos con
                prueba asignada
              </>
            ) : undefined
          }
          icon={CheckCircle2}
          tone="success"
          loading={simulators.isLoading}
        />
        {averages.map((average) => (
          <StatCard
            key={average.grade}
            label={`Promedio ${average.grade}`}
            value={`${average.latest_average || average.average_score} / ${kpis?.max_score ?? 500}`}
            delta={
              average.delta === null || average.delta === undefined ? (
                "primer corte medido del grado"
              ) : (
                <>
                  <b className="font-semibold text-foreground">
                    {average.delta > 0 ? `+${average.delta}` : average.delta}
                  </b>{" "}
                  frente al corte anterior
                </>
              )
            }
            icon={BarChart3}
            tone="teal"
            loading={simulators.isLoading}
          />
        ))}
        {averages.length === 0 && (
          <StatCard
            label="Promedio por grado"
            value="—"
            delta="Todavía no hay simulacros corregidos"
            icon={BarChart3}
            tone="teal"
            loading={simulators.isLoading}
          />
        )}
      </div>

      <SectionCard
        className="overflow-hidden"
        bodyClassName="p-0"
        title="Simulacros por grado"
        description="Los carga la plataforma; tú los activas por curso"
      >
        {simulators.isError ? (
          <p role="alert" className="px-[18px] py-6 text-[13px] text-destructive">
            {simulators.error.message}
          </p>
        ) : simulators.isLoading ? (
          <div className="space-y-2 px-[18px] py-4" aria-hidden>
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-lg bg-muted"
                style={{ animationDelay: `${index * 70}ms` }}
              />
            ))}
          </div>
        ) : (simulators.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            icon={Target}
            title="Sin simulacros habilitados"
            description="El equipo de Lumen habilita los simulacros para tu colegio. Cuando haya uno disponible, aparecerá aquí para que lo actives por curso."
          />
        ) : (
          <TableShell>
            <PanelTable className="w-full border-collapse">
              <caption className="sr-only">
                Simulacros habilitados para tu colegio, con los cursos activados y su puntaje
              </caption>
              <thead>
                <tr>
                  <th scope="col" className={`${tableHeadClass} min-w-[240px]`}>
                    Simulacro
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[90px]`}>
                    Grado
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[110px]`}>
                    Preguntas
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[130px]`}>
                    Fecha
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[130px]`}>
                    Estado
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[190px]`}>
                    Activación
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[150px]`}>
                    Puntaje promedio
                  </th>
                  <th scope="col" className={`${tableHeadClass} w-[100px]`}>
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(simulators.data?.items ?? []).map((simulator) => (
                  <tr key={simulator.id} className="transition-colors hover:bg-muted">
                    <td className={tableCellClass}>
                      <div className="font-medium">{simulator.name}</div>
                      <div className="mt-px font-mono text-[12px] text-muted-foreground">
                        {simulator.code}
                      </div>
                    </td>
                    <td className={tableCellClass}>{simulator.grade}</td>
                    <td className={`${tableCellClass} font-mono text-[12.4px]`}>
                      {simulator.question_count}
                    </td>
                    <td
                      className={`${tableCellClass} font-mono text-[12.4px] text-muted-foreground`}
                    >
                      {shortDate(simulator.scheduled_at)}
                    </td>
                    <td className={tableCellClass}>
                      <Chip tone={simulator.status === "cerrado" ? "muted" : "info"} dot>
                        {statusLabel(simulator.status)}
                      </Chip>
                    </td>
                    <td className={tableCellClass}>
                      {simulator.activations.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {simulator.activations.map((activation) => (
                            <Chip key={activation.course_id} tone="muted">
                              {activation.course_name}
                            </Chip>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sin activar</span>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      {simulator.average_score === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <b className="font-mono text-[12.5px]">
                          {simulator.average_score} / {kpis?.max_score ?? 500}
                        </b>
                      )}
                    </td>
                    <td className={tableCellClass}>
                      <div className="flex justify-end gap-1">
                        {simulator.activated ? (
                          <button
                            type="button"
                            onClick={() => setSelected(simulator)}
                            className="rounded-md px-1.5 py-0.5 text-[13px] text-primary transition-colors hover:bg-primary-soft"
                          >
                            Abrir
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (!canActivate) return;
                              openActivation(simulator);
                            }}
                            aria-disabled={!canActivate}
                            aria-describedby={canActivate ? undefined : "icfes-activate-reason"}
                            title={
                              canActivate
                                ? "Activar este simulacro por curso"
                                : "Esta acción la hace el administrador principal del colegio."
                            }
                            className="rounded-md px-1.5 py-0.5 text-[13px] text-primary transition-colors hover:bg-primary-soft aria-disabled:cursor-not-allowed aria-disabled:text-muted-foreground aria-disabled:hover:bg-transparent"
                          >
                            Activar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </PanelTable>
          </TableShell>
        )}

        <p className="flex items-start gap-2 border-t border-border px-[18px] py-3.5 text-[12.5px] text-muted-foreground">
          <Info className="mt-px size-4 shrink-0 text-primary" strokeWidth={1.9} aria-hidden />
          <span>
            El equipo de Lumen carga y habilita los simulacros; tu colegio decide en qué cursos se
            aplican y hasta qué fecha. Un simulacro sin activar no llega a los estudiantes.
          </span>
        </p>
      </SectionCard>

      {/* The activation: the courses where the simulator runs and the
          deadline of the proof. */}
      {toActivate && (
        <SectionCard
          className="mt-4"
          title={`Activar ${toActivate.name}`}
          description={`Elige los cursos donde corre la prueba y la fecha límite (${toActivate.code}).`}
        >
          <form className="space-y-3" onSubmit={onActivate}>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cursos
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(courses.data ?? []).map((course) => {
                  const checked = courseIds.includes(course.id);
                  return (
                    <label
                      key={course.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-idx border px-3 py-2 text-[13px] transition-colors ${
                        checked
                          ? "border-primary/50 bg-primary-soft text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-input"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setCourseIds((current) =>
                            current.includes(course.id)
                              ? current.filter((id) => id !== course.id)
                              : [...current, course.id],
                          )
                        }
                        className="size-[15px] accent-primary"
                      />
                      {course.name}
                    </label>
                  );
                })}
                {(courses.data ?? []).length === 0 && (
                  <p className="text-[13px] text-muted-foreground">
                    El colegio todavía no tiene cursos. Crea uno en «Cursos y materias».
                  </p>
                )}
              </div>
            </fieldset>

            <label className="block max-w-[260px]">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Fecha límite
              </span>
              <input
                type="date"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                required
                className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </label>

            {formError && (
              <p role="alert" className="text-[13px] text-destructive">
                {formError}
              </p>
            )}
            {activate.error && (
              <p role="alert" className="text-[13px] text-destructive">
                {activate.error.message}
              </p>
            )}

            <div className="flex items-center gap-2">
              <Button type="submit" icon={Target} disabled={activate.isPending}>
                {activate.isPending ? "Activando..." : "Activar simulacro"}
              </Button>
              <Button variant="ghost" icon={X} onClick={() => setToActivate(null)} type="button">
                Cancelar
              </Button>
            </div>
          </form>
        </SectionCard>
      )}

      {/* The result of the simulator, course by course. */}
      <Drawer open={Boolean(selected)} onOpenChange={(open: boolean) => !open && setSelected(null)}>
        <DrawerContent className="w-full border-l border-border bg-card sm:max-w-[460px]">
          <DrawerHeader className="border-b border-border px-[18px] py-4">
            <DrawerTitle className="text-[15px] font-semibold">
              {results.data?.name ?? selected?.name ?? "Simulacro"}
            </DrawerTitle>
            <DrawerDescription className="font-mono text-[12px] text-muted-foreground">
              {results.data?.code ?? selected?.code}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-[18px] py-4">
            {results.isLoading ? (
              <div className="h-24 animate-pulse rounded-xl bg-muted" aria-hidden />
            ) : results.data ? (
              <>
                <dl className="grid grid-cols-[118px_1fr] gap-x-3.5 gap-y-2.5 text-[13.2px]">
                  <dt className="text-[12.4px] text-muted-foreground">Grado</dt>
                  <dd>{results.data.grade}</dd>
                  <dt className="text-[12.4px] text-muted-foreground">Preguntas</dt>
                  <dd className="font-mono">{results.data.question_count}</dd>
                  <dt className="text-[12.4px] text-muted-foreground">Duración</dt>
                  <dd>{results.data.duration_min} min</dd>
                  <dt className="text-[12.4px] text-muted-foreground">Fecha</dt>
                  <dd className="font-mono">{shortDate(results.data.scheduled_at)}</dd>
                  <dt className="text-[12.4px] text-muted-foreground">Puntaje promedio</dt>
                  <dd className="font-mono">
                    {results.data.average_score === null
                      ? "—"
                      : `${results.data.average_score} / ${results.data.max_score}`}
                  </dd>
                </dl>

                <h3 className="mt-5 text-[13px] font-semibold">Cursos activados</h3>
                {results.data.courses.length === 0 ? (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    Este simulacro todavía no está activado en ningún curso.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {results.data.courses.map((course) => (
                      <li
                        key={course.course_id}
                        className="rounded-xl border border-border bg-secondary p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[13.2px] font-medium">{course.course_name}</span>
                          <span className="font-mono text-[12.4px] text-muted-foreground">
                            {course.students} respuestas
                          </span>
                        </div>
                        <p className="mt-1 text-[12.4px] text-muted-foreground">
                          Límite {shortDate(course.deadline)} · promedio{" "}
                          <b className="font-mono text-foreground">
                            {course.average_score === null
                              ? "—"
                              : `${course.average_score} / ${results.data.max_score}`}
                          </b>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                No se pudo cargar el resultado del simulacro.
              </p>
            )}
          </div>

          <div className="border-t border-border px-[18px] py-4">
            <DrawerClose className="inline-flex w-full items-center justify-center gap-2 rounded-idx border border-input bg-card px-[15px] py-2 text-[13.2px] font-medium text-foreground transition-colors hover:bg-secondary">
              <X className="size-[15.5px]" strokeWidth={1.9} aria-hidden />
              Cerrar
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>

      {!canActivate && (
        <p id="icfes-activate-reason" className="sr-only">
          Activar un simulacro lo hace el administrador principal del colegio.
        </p>
      )}

      <p className="mt-6 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        <Chip tone="muted" dot>
          Sistema operativo
        </Chip>
        <span>
          El puntaje promedio se calcula con las respuestas de los estudiantes de los cursos
          activados, sobre una escala de {kpis?.max_score ?? 500} puntos.
        </span>
      </p>
    </>
  );
}
