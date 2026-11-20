import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, XCircle } from "lucide-react";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { StatusBadge } from "@/components/status-badge";
import { ICFES_AREAS, shuffle } from "@/lib/icfes-data";
import { exportElementToPdf } from "@/lib/pdf-export";
import {
  useStartIcfesAttempt,
  useFinalizeIcfesAttempt,
  type IcfesQuestionForStudent,
  type FinalizeResponse,
} from "@/lib/icfes/api";
import { cn } from "@/lib/utils";

export type IcfesSimulacro = {
  id: string;
  nombre: string;
  minutos: number;
  aleatorizarPreguntas: boolean;
  aleatorizarOpciones: boolean;
};

type Answers = Record<string, number | undefined>;

export function IcfesExam({
  simulacro,
  onExit,
}: {
  simulacro: IcfesSimulacro;
  onExit: () => void;
}) {
  const startAttempt = useStartIcfesAttempt();
  const finalize = useFinalizeIcfesAttempt();

  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<IcfesQuestionForStudent[]>([]);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [restante, setRestante] = useState(simulacro.minutos * 60);
  const [finalizado, setFinalizado] = useState(false);
  const [result, setResult] = useState<FinalizeResponse | null>(null);

  // On mount, start the attempt and load the questions from the backend.
  useEffect(() => {
    if (attemptId) return;
    let cancelled = false;
    startAttempt.mutateAsync({ simulationId: simulacro.id }).then((res) => {
      if (cancelled) return;
      setAttemptId(res.attempt_id);
      const sortedQuestions = simulacro.aleatorizarPreguntas
        ? shuffle(res.questions)
        : res.questions;
      setQuestions(sortedQuestions);
    });
    return () => {
      cancelled = true;
    };
  }, [simulacro, attemptId, startAttempt]);

  // Randomize option order per question locally (the backend returns the
  // canonical option array). The chosen_index we POST is the canonical
  // index, so we keep a per-question map of displayed -> canonical.
  const optionMap = useMemo(() => {
    const map: Record<string, number[]> = {};
    for (const q of questions) {
      const idx = [0, 1, 2, 3];
      map[q.id] = simulacro.aleatorizarOpciones ? shuffle(idx) : idx;
    }
    return map;
  }, [questions, simulacro.aleatorizarOpciones]);

  // Countdown timer.
  useEffect(() => {
    if (finalizado) return;
    if (!attemptId) return;
    const t = setInterval(() => {
      setRestante((s) => {
        if (s <= 1) {
          clearInterval(t);
          finalizeAndGrade();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [finalizado, attemptId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finalizeAndGrade() {
    if (!attemptId || questions.length === 0) return;
    const answerPayload = questions.map((q) => ({
      question_id: q.id,
      chosen_index: answers[q.id] ?? null,
    }));
    const res = await finalize.mutateAsync({ attemptId, answers: answerPayload });
    setResult(res);
    setFinalizado(true);
  }

  if (finalizado && result) {
    return (
      <IcfesIndividualResult
        titulo={simulacro.nombre}
        questions={questions}
        answers={answers}
        result={result}
        onBack={onExit}
      />
    );
  }

  if (questions.length === 0) {
    return <p className="text-sm text-muted-foreground">Cargando preguntas...</p>;
  }

  const q = questions[index];
  if (!q) return null;
  const respondidas = questions.filter((p) => answers[p.id] !== undefined).length;
  const mm = String(Math.floor(restante / 60)).padStart(2, "0");
  const ss = String(restante % 60).padStart(2, "0");

  return (
    <>
      <PageHeader
        title={simulacro.nombre}
        subtitle={`${questions.length} preguntas · ${simulacro.minutos} minutos`}
        actions={
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold tabular-nums",
              restante < 300
                ? "bg-destructive-soft text-destructive"
                : "bg-warning-soft text-warning-foreground",
            )}
          >
            <Clock className="size-4" /> {mm}:{ss}
          </span>
        }
      />

      <SectionCard bodyClassName="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold text-muted-foreground">
            Respondidas {respondidas} / {questions.length}
          </p>
          <p className="text-xs text-muted-foreground">
            Sin responder {questions.length - respondidas}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {questions.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setIndex(i)}
              className={cn(
                "size-9 rounded-lg text-xs font-bold transition-colors",
                i === index
                  ? "bg-primary text-primary-foreground"
                  : answers[p.id] !== undefined
                    ? "bg-success-soft text-success"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title={`Pregunta ${index + 1} de ${questions.length}`}
        description={`${q.area} · ${q.points} pts`}
        bodyClassName="p-4 sm:p-5"
      >
        {q.reading && (
          <p className="mb-4 rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed">
            {q.reading}
          </p>
        )}
        <p className="text-base font-medium">{q.prompt}</p>
        <ul className="mt-4 space-y-2">
          {(optionMap[q.id] ?? [0, 1, 2, 3]).map((canonicalIndex, i) => (
            <li key={canonicalIndex}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3.5 text-sm transition-colors",
                  answers[q.id] === canonicalIndex
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name={`q-${q.id}`}
                  checked={answers[q.id] === canonicalIndex}
                  onChange={() => setAnswers((a) => ({ ...a, [q.id]: canonicalIndex }))}
                  className="accent-[var(--color-primary)]"
                />
                <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
                <span className="min-w-0">{q.options[canonicalIndex]}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-between">
          <button
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-4 py-3 text-sm font-semibold hover:bg-muted disabled:opacity-40"
          >
            <ChevronLeft className="size-4" /> Anterior
          </button>
          {index === questions.length - 1 ? (
            <button
              onClick={() => finalizeAndGrade()}
              disabled={finalize.isPending}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-success px-5 py-3 text-sm font-semibold text-success-foreground hover:opacity-90 disabled:opacity-40"
            >
              <CheckCircle2 className="size-4" />
              {finalize.isPending ? "Enviando..." : "Finalizar y enviar"}
            </button>
          ) : (
            <button
              onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Siguiente <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </SectionCard>
    </>
  );
}

function IcfesIndividualResult({
  titulo,
  questions,
  answers,
  result,
  onBack,
}: {
  titulo: string;
  questions: IcfesQuestionForStudent[];
  answers: Answers;
  result: FinalizeResponse;
  onBack?: () => void;
}) {
  // Re-render the chosen-answer breakdown using the questions + answers.
  return (
    <>
      <PageHeader
        title="Resultado del simulacro"
        subtitle={titulo}
        actions={
          <div className="flex flex-wrap gap-2">
            {onBack && (
              <button
                onClick={onBack}
                className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                Volver
              </button>
            )}
          </div>
        }
      />

      <SectionCard title="Puntaje">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-primary-soft p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Puntaje global
            </p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight text-primary">
              {result.puntaje_global}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Escala 0 – 500</p>
          </div>
          <div className="rounded-lg border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Correctas
            </p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">
              {result.correct_count}
              <span className="text-lg text-muted-foreground">/{result.question_count}</span>
            </p>
          </div>
          <div className="rounded-lg border border-border p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acierto
            </p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">{result.percent}%</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Desglose por área">
        <ul className="space-y-4">
          {ICFES_AREAS.filter((a) => result.by_area.some((b) => b.area === a)).map((area) => {
            const agg = result.by_area.find((b) => b.area === area);
            if (!agg) return null;
            return (
              <li key={area}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{area}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {agg.correct}/{agg.total} · {agg.percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      agg.percent >= 70
                        ? "bg-success"
                        : agg.percent >= 40
                          ? "bg-warning"
                          : "bg-destructive",
                    )}
                    style={{ width: `${agg.percent}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    </>
  );
}
