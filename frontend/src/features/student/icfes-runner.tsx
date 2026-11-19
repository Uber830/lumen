// =============================================================================
// The student's ICFES runner.
// -----------------------------------------------------------------------------
// A simulation is a set of published questions. The student answers them
// and finalizes the attempt; the backend scores it against the answer
// keys, which never reach the browser.
//
// The old runner scored in the browser with the keys bundled in the
// page. This one only sends the chosen options.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send, Target } from "lucide-react";

import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { formatCountdown, useCountdown } from "@/features/student/use-countdown";
import { useFinalizeIcfesAttempt, useStartIcfesAttempt } from "@/features/student/use-icfes";
import { cn } from "@/lib/utils";
import type { IcfesAttemptQuestion, IcfesAttemptScore, IcfesSimulation } from "@/lib/api/types";

export function IcfesRunner({
  simulation,
  onExit,
}: {
  simulation: IcfesSimulation;
  onExit: () => void;
}) {
  const start = useStartIcfesAttempt();
  const finalize = useFinalizeIcfesAttempt();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<IcfesAttemptQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState<IcfesAttemptScore | null>(null);
  // The attempt starts now: the backend does not expose when an
  // attempt was opened, so the clock is anchored to this screen.
  const [startedAt] = useState(() => new Date().toISOString());

  const { mutate: startAttempt } = start;
  useEffect(() => {
    startAttempt(simulation.id, {
      onSuccess: (started) => {
        setAttemptId(started.attempt_id);
        setQuestions(started.questions);
      },
    });
  }, [simulation.id, startAttempt]);

  const durationSeconds = simulation.duration_minutes ? simulation.duration_minutes * 60 : null;
  const remaining = useCountdown({
    startedAt: attemptId ? startedAt : null,
    durationSeconds,
    onExpire: () => {
      void handleFinalize();
    },
  });

  const question = questions[index];

  async function handleFinalize() {
    if (!attemptId || finalize.isPending) return;
    const payload = questions.map((item) => ({
      question_id: item.id,
      chosen_index: answers[item.id] ?? null,
    }));
    const result = await finalize.mutateAsync({ attemptId, answers: payload });
    setScore(result);
  }

  if (score) {
    return <IcfesResult score={score} onExit={onExit} />;
  }

  if (start.isError) {
    return (
      <SectionCard title="No se pudo iniciar el simulacro">
        <p role="alert" className="text-sm text-destructive">
          {start.error.message}
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
        >
          Volver
        </button>
      </SectionCard>
    );
  }

  return (
    <>
      <PageHeader
        title={simulation.title}
        subtitle={`${questions.length} preguntas · ${simulation.duration_minutes ?? 60} minutos`}
        actions={
          durationSeconds ? (
            <span className="inline-flex items-center gap-2 rounded-lg bg-warning-soft px-4 py-2.5 text-sm font-bold text-warning-foreground">
              Tiempo: {formatCountdown(remaining)}
            </span>
          ) : null
        }
      />

      {start.isPending || !attemptId ? (
        <SectionCard>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Preparando el simulacro...
          </p>
        </SectionCard>
      ) : !question ? (
        <SectionCard title="Este simulacro no tiene preguntas">
          <p className="text-sm text-muted-foreground">
            Pide al docente o al administrador que agregue preguntas al simulacro.
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <SectionCard
            title={`Pregunta ${index + 1} de ${questions.length}`}
            description={question.area}
          >
            {question.reading ? (
              <p className="mb-4 rounded-lg border border-border bg-muted/40 p-4 text-sm leading-relaxed text-muted-foreground">
                {question.reading}
              </p>
            ) : null}

            <p className="text-base font-medium">{question.prompt}</p>

            <ul className="mt-4 space-y-2">
              {question.options.map((option, optionIndex) => {
                const selected = answers[question.id] === optionIndex;
                return (
                  <li key={`${question.id}-${optionIndex}`}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary-soft"
                          : "border-border hover:bg-muted",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={selected}
                        onChange={() =>
                          setAnswers((previous) => ({ ...previous, [question.id]: optionIndex }))
                        }
                        className="accent-[var(--color-primary)]"
                      />
                      {option}
                    </label>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIndex((value) => Math.max(0, value - 1))}
                  disabled={index === 0}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ChevronLeft className="size-4" /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((value) => Math.min(questions.length - 1, value + 1))}
                  disabled={index >= questions.length - 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente <ChevronRight className="size-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => void handleFinalize()}
                disabled={finalize.isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {finalize.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
                Entregar simulacro
              </button>
            </div>

            {finalize.isError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {finalize.error.message}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Preguntas" bodyClassName="p-4">
            <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
              {questions.map((item, position) => {
                const answered = answers[item.id] !== undefined;
                const active = position === index;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIndex(position)}
                    aria-label={`Ir a la pregunta ${position + 1}`}
                    className={cn(
                      "grid size-9 place-items-center rounded-lg border text-xs font-semibold transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : answered
                          ? "border-primary/40 bg-primary-soft text-primary"
                          : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {position + 1}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Respondidas: {Object.keys(answers).length} de {questions.length}
            </p>
            <button
              type="button"
              onClick={onExit}
              className="mt-4 w-full rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              Guardar y salir
            </button>
          </SectionCard>
        </div>
      )}
    </>
  );
}

/** The result of a finalized attempt, calculated by the backend. */
function IcfesResult({ score, onExit }: { score: IcfesAttemptScore; onExit: () => void }) {
  const areas = useMemo(() => score.by_area ?? [], [score.by_area]);

  return (
    <>
      <PageHeader title="Resultado del simulacro" subtitle="Calculado por el backend" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Puntaje Saber 11</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">{score.puntaje_global}</p>
          <p className="mt-1 text-xs text-muted-foreground">de 500 puntos</p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Aciertos</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            {score.correct_count}
            <span className="text-lg text-muted-foreground"> / {score.question_count}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {score.percent.toFixed(0)}% del puntaje total
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Estado</p>
          <div className="mt-3">
            <StatusBadge tone={score.percent >= 50 ? "success" : "warning"}>
              <CheckCircle2 className="size-3" /> Calificado
            </StatusBadge>
          </div>
        </div>
      </div>

      <SectionCard title="Resultado por área" bodyClassName="p-0">
        {areas.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            El simulacro no tiene resultados por área.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {areas.map((area) => (
              <li key={area.area} className="px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Target className="size-4 text-muted-foreground" /> {area.area}
                  </p>
                  <p className="text-sm font-semibold">
                    {area.correct}/{area.total} · {area.percent.toFixed(0)}%
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, Math.max(0, area.percent))}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <button
        type="button"
        onClick={onExit}
        className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
      >
        Volver a los simulacros
      </button>
    </>
  );
}
