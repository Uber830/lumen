import { createFileRoute, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play } from "lucide-react";

import { PageHeader, SectionCard, StatCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { EvaluationRunner } from "@/features/student/evaluation-runner";
import { useStudentEvaluations, type StudentEvaluation } from "@/features/student/use-evaluations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estudiante/evaluaciones")({
  head: () => ({
    meta: [
      { title: "Evaluaciones — Lumen" },
      {
        name: "description",
        content: "Evaluaciones pendientes y resueltas, con interfaz de examen y temporizador.",
      },
      { property: "og:title", content: "Evaluaciones — Lumen" },
      {
        property: "og:description",
        content: "Rendí tus exámenes online desde cualquier dispositivo.",
      },
    ],
  }),
  component: Evaluaciones,
});

function formatDate(value: string | null): string {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Sin fecha" : date.toLocaleDateString("es-CO");
}

/** The state of an evaluation for the student: what they still owe. */
function stateOf(evaluation: StudentEvaluation): "pendiente" | "en_curso" | "entregada" {
  if (!evaluation.attempt) return "pendiente";
  if (evaluation.attempt.status === "in_progress") return "en_curso";
  return "entregada";
}

function Evaluaciones() {
  const { session } = useRouteContext({ from: "/estudiante/evaluaciones" });
  const schoolId = session.primarySchoolId;
  const studentId = session.user.id;

  const evaluations = useStudentEvaluations(schoolId, studentId);
  const [activeId, setActiveId] = useState<string | null>(null);

  if (!schoolId || !studentId) {
    return (
      <div className="surface-card mx-auto max-w-md p-8 text-center">
        <h1 className="text-xl font-semibold">No hay colegio activo</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tu cuenta no está asociada a un colegio.
        </p>
      </div>
    );
  }

  const active = evaluations.data?.find((evaluation) => evaluation.id === activeId) ?? null;
  if (active) {
    return <EvaluationRunner evaluation={active} onExit={() => setActiveId(null)} />;
  }

  const rows = evaluations.data ?? [];
  const pending = rows.filter((evaluation) => stateOf(evaluation) !== "entregada");
  const delivered = rows.filter((evaluation) => stateOf(evaluation) === "entregada");

  return (
    <>
      <PageHeader title="Evaluaciones" subtitle="Rendí tus exámenes y revisa tus resultados" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pendientes"
          value={String(pending.length)}
          delta={pending.length > 0 ? "Rendilas antes de la fecha" : "Todo al día"}
          tone={pending.length > 0 ? "warning" : "success"}
        />
        <StatCard label="Entregadas" value={String(delivered.length)} tone="primary" />
        <StatCard
          label="Promedio"
          value={averageOf(delivered)}
          delta="De las evaluaciones entregadas"
          tone="success"
        />
      </div>

      <SectionCard title="Mis evaluaciones" bodyClassName="p-0">
        {evaluations.isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">Cargando evaluaciones...</p>
        ) : evaluations.error ? (
          <p role="alert" className="px-5 py-6 text-sm text-destructive">
            {evaluations.error.message}
          </p>
        ) : rows.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            Todavía no hay evaluaciones publicadas en tus materias.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((evaluation) => {
              const state = stateOf(evaluation);
              const attempt = evaluation.attempt;
              return (
                <li
                  key={evaluation.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{evaluation.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {evaluation.subject_name}
                      {evaluation.course_name ? ` · ${evaluation.course_name}` : ""} · Vence:{" "}
                      {formatDate(evaluation.due_at)}
                    </p>
                    {evaluation.description ? (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {evaluation.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    {evaluation.duration_minutes ? (
                      <StatusBadge tone="neutral">
                        <Clock className="size-3" /> {evaluation.duration_minutes} min
                      </StatusBadge>
                    ) : null}

                    {state === "entregada" && attempt && attempt.score !== null ? (
                      <StatusBadge tone="success">
                        <CheckCircle2 className="size-3" /> {Number(attempt.score).toFixed(1)}
                        {attempt.max_score !== null ? ` / ${Number(attempt.max_score)}` : ""}
                      </StatusBadge>
                    ) : state === "en_curso" ? (
                      <StatusBadge tone="warning">En curso</StatusBadge>
                    ) : state === "entregada" ? (
                      <StatusBadge tone="info">En revisión</StatusBadge>
                    ) : (
                      <StatusBadge tone="neutral">Pendiente</StatusBadge>
                    )}

                    {state !== "entregada" ? (
                      <button
                        type="button"
                        onClick={() => setActiveId(evaluation.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold",
                          "bg-primary text-primary-foreground hover:bg-primary/90",
                        )}
                      >
                        {state === "en_curso" ? (
                          <>
                            <Loader2 className="size-3.5" /> Continuar
                          </>
                        ) : (
                          <>
                            <Play className="size-3.5" /> Rendir
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {rows.some((evaluation) => stateOf(evaluation) === "entregada") ? (
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          Las preguntas abiertas las corrige tu docente; el puntaje final aparece en "Mis notas".
        </p>
      ) : null}
    </>
  );
}

/** The average of the delivered evaluations, as a string. */
function averageOf(evaluations: StudentEvaluation[]): string {
  const scores = evaluations
    .map((evaluation) => evaluation.attempt)
    .filter((attempt): attempt is NonNullable<typeof attempt> => attempt?.score !== null)
    .map((attempt) => Number(attempt.score));
  if (scores.length === 0) return "—";
  return (scores.reduce((total, score) => total + score, 0) / scores.length).toFixed(2);
}
