// =============================================================================
// The student's evaluation runner.
// -----------------------------------------------------------------------------
// The screen a student sees while they take an evaluation: one question
// at a time, a clock, and the answers saved to the backend as they go.
//
// The scoring is not here: when the attempt is submitted, the backend
// compares the answers with the answer keys and returns the score. The
// browser only shows what the API tells it.
// =============================================================================

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Send,
} from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { PageHeader, SectionCard } from "@/components/ui-kit";
import { formatCountdown, useCountdown } from "@/features/student/use-countdown";
import {
  answerFromRow,
  useAttemptAnswers,
  useClearEvaluationAnswer,
  useEvaluationQuestions,
  useSaveEvaluationAnswer,
  useStartEvaluationAttempt,
  useSubmitEvaluationAttempt,
  type EvaluationAnswerInput,
  type StudentEvaluation,
} from "@/features/student/use-evaluations";
import { cn } from "@/lib/utils";
import type { EvaluationAttempt, EvaluationQuestion } from "@/lib/api/types";

export function EvaluationRunner({
  evaluation,
  onExit,
}: {
  evaluation: StudentEvaluation;
  onExit: () => void;
}) {
  const start = useStartEvaluationAttempt();
  const [attempt, setAttempt] = useState<EvaluationAttempt | null>(null);

  // Starting is idempotent on the server: the student keeps the
  // attempt they already had.
  const { mutate: startAttempt } = start;
  useEffect(() => {
    startAttempt(evaluation.id, { onSuccess: setAttempt });
  }, [evaluation.id, startAttempt]);

  const questions = useEvaluationQuestions(attempt ? evaluation.id : null);
  const savedAnswers = useAttemptAnswers(attempt?.id ?? null);
  const save = useSaveEvaluationAnswer();
  const clear = useClearEvaluationAnswer();
  const submit = useSubmitEvaluationAttempt();

  const [answers, setAnswers] = useState<Record<string, EvaluationAnswerInput>>({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<EvaluationAttempt | null>(null);
  const submittedRef = useRef(false);

  // The answers of an attempt that was already in progress.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !savedAnswers.data) return;
    seeded.current = true;
    const restored: Record<string, EvaluationAnswerInput> = {};
    for (const row of savedAnswers.data) {
      const answer = answerFromRow(row);
      if (answer) restored[row.question_id] = answer;
    }
    setAnswers(restored);
  }, [savedAnswers.data]);

  function handleSubmit() {
    if (!attempt || submittedRef.current) return;
    submittedRef.current = true;

    // The text of an open question is saved when the field loses the
    // focus. It is saved again here, so the last thing the student
    // typed is never lost when the clock runs out.
    const pending = question?.kind === "open" ? answers[question.id] : undefined;

    const finish = async () => {
      if (pending?.kind === "open" && pending.text.trim()) {
        await save.mutateAsync({
          attemptId: attempt.id,
          questionId: question.id,
          answer: pending,
        });
      }
      const graded = await submit.mutateAsync(attempt.id);
      setResult(graded);
    };

    finish().catch(() => {
      // A failed submission can be retried.
      submittedRef.current = false;
    });
  }

  // A failed submission can be retried.
  useEffect(() => {
    if (submit.isError) submittedRef.current = false;
  }, [submit.isError]);

  const durationSeconds = evaluation.duration_minutes ? evaluation.duration_minutes * 60 : null;
  const remaining = useCountdown({
    startedAt: attempt?.started_at ?? null,
    durationSeconds,
    onExpire: handleSubmit,
  });

  const list = questions.data ?? [];
  const question = list[index];

  function choose(answer: EvaluationAnswerInput) {
    if (!attempt || !question) return;
    setAnswers((previous) => ({ ...previous, [question.id]: answer }));
    save.mutate({ attemptId: attempt.id, questionId: question.id, answer });
  }

  function chooseOption(optionIndex: number) {
    if (!question) return;
    const current = answers[question.id];
    if (current?.kind === "multiple_choice" && current.index === optionIndex) {
      removeAnswer();
      return;
    }
    choose({ kind: "multiple_choice", index: optionIndex });
  }

  function chooseBoolean(value: boolean) {
    if (!question) return;
    const current = answers[question.id];
    if (current?.kind === "true_false" && current.value === value) {
      removeAnswer();
      return;
    }
    choose({ kind: "true_false", value });
  }

  function saveText(text: string) {
    if (!question) return;
    setAnswers((previous) => ({ ...previous, [question.id]: { kind: "open", text } }));
  }

  function commitText(text: string) {
    if (!attempt || !question) return;
    save.mutate({
      attemptId: attempt.id,
      questionId: question.id,
      answer: { kind: "open", text },
    });
  }

  function removeAnswer() {
    if (!attempt || !question) return;
    setAnswers((previous) => {
      const next = { ...previous };
      delete next[question.id];
      return next;
    });
    clear.mutate({ attemptId: attempt.id, questionId: question.id });
  }

  if (start.isError) {
    return (
      <SectionCard title="No se pudo iniciar la evaluación">
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

  if (result) {
    return <EvaluationResult attempt={result} onExit={onExit} />;
  }

  return (
    <>
      <PageHeader
        title={evaluation.title}
        subtitle={`${evaluation.subject_name} · ${evaluation.course_name}`}
        actions={
          durationSeconds ? (
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold",
                remaining !== null && remaining <= 60
                  ? "bg-destructive-soft text-destructive"
                  : "bg-warning-soft text-warning-foreground",
              )}
            >
              Tiempo: {formatCountdown(remaining)}
            </span>
          ) : null
        }
      />

      {questions.isLoading || !attempt ? (
        <SectionCard>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Preparando la evaluación...
          </p>
        </SectionCard>
      ) : questions.error ? (
        <SectionCard title="No se pudieron cargar las preguntas">
          <p role="alert" className="text-sm text-destructive">
            {questions.error.message}
          </p>
        </SectionCard>
      ) : !question ? (
        <SectionCard title="Esta evaluación no tiene preguntas">
          <p className="text-sm text-muted-foreground">
            Habla con tu docente para que agregue las preguntas.
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <SectionCard
            title={`Pregunta ${index + 1} de ${list.length}`}
            description={`${question.kind === "multiple_choice" ? "Opción múltiple" : question.kind === "true_false" ? "Verdadero o falso" : "Respuesta abierta"} · ${question.points} puntos`}
          >
            <p className="text-base font-medium">{question.prompt}</p>

            <div className="mt-4">
              <QuestionInput
                question={question}
                answer={answers[question.id] ?? null}
                onChoose={chooseOption}
                onChooseBoolean={chooseBoolean}
                onChangeText={saveText}
                onCommitText={commitText}
              />
            </div>

            {save.isError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {save.error.message}
              </p>
            ) : null}

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
                  onClick={() => setIndex((value) => Math.min(list.length - 1, value + 1))}
                  disabled={index >= list.length - 1}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Siguiente <ChevronRight className="size-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                {answers[question.id] ? (
                  <button
                    type="button"
                    onClick={removeAnswer}
                    className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted"
                  >
                    Quitar respuesta
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submit.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submit.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Entregar
                </button>
              </div>
            </div>

            {submit.isError ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {submit.error.message}
              </p>
            ) : null}
          </SectionCard>

          <SectionCard title="Preguntas" bodyClassName="p-4">
            <div className="grid grid-cols-6 gap-2 lg:grid-cols-5">
              {list.map((item, position) => {
                const answered = Boolean(answers[item.id]);
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
              Respondidas: {Object.keys(answers).length} de {list.length}
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

/** The input of a question, one per kind. */
function QuestionInput({
  question,
  answer,
  onChoose,
  onChooseBoolean,
  onChangeText,
  onCommitText,
}: {
  question: EvaluationQuestion;
  answer: EvaluationAnswerInput | null;
  onChoose: (index: number) => void;
  onChooseBoolean: (value: boolean) => void;
  onChangeText: (text: string) => void;
  onCommitText: (text: string) => void;
}) {
  if (question.kind === "multiple_choice") {
    return (
      <ul className="space-y-2">
        {(question.options ?? []).map((option, optionIndex) => {
          const selected = answer?.kind === "multiple_choice" && answer.index === optionIndex;
          return (
            <li key={`${question.id}-${optionIndex}`}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                  selected ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={selected}
                  onChange={() => onChoose(optionIndex)}
                  className="accent-[var(--color-primary)]"
                />
                {option}
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  if (question.kind === "true_false") {
    const options: Array<{ label: string; value: boolean }> = [
      { label: "Verdadero", value: true },
      { label: "Falso", value: false },
    ];
    return (
      <ul className="space-y-2">
        {options.map((option) => {
          const selected = answer?.kind === "true_false" && answer.value === option.value;
          return (
            <li key={option.value ? "true" : "false"}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                  selected ? "border-primary bg-primary-soft" : "border-border hover:bg-muted",
                )}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={selected}
                  onChange={() => onChooseBoolean(option.value)}
                  className="accent-[var(--color-primary)]"
                />
                {option.label}
              </label>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <textarea
      rows={5}
      value={answer?.kind === "open" ? answer.text : ""}
      onChange={(event) => onChangeText(event.target.value)}
      onBlur={(event) => onCommitText(event.target.value)}
      placeholder="Escribe tu respuesta..."
      className="w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

/** The result of a submitted attempt. */
function EvaluationResult({ attempt, onExit }: { attempt: EvaluationAttempt; onExit: () => void }) {
  const score = attempt.score !== null ? Number(attempt.score) : null;
  const maxScore = attempt.max_score !== null ? Number(attempt.max_score) : null;
  const percent =
    score !== null && maxScore !== null && maxScore > 0 ? (score / maxScore) * 100 : null;

  return (
    <>
      <PageHeader
        title="Evaluación entregada"
        subtitle="Este es el resultado que calculó el backend"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="surface-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Puntaje</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            {score !== null ? score : "—"}
            {maxScore !== null ? (
              <span className="text-lg text-muted-foreground"> / {maxScore}</span>
            ) : null}
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Desempeño</p>
          <p className="mt-3 text-3xl font-bold tracking-tight">
            {percent !== null ? `${percent.toFixed(0)}%` : "—"}
          </p>
        </div>
        <div className="surface-card p-5">
          <p className="text-sm font-medium text-muted-foreground">Estado</p>
          <div className="mt-3">
            {attempt.status === "graded" ? (
              <StatusBadge tone="success">
                <CheckCircle2 className="size-3" /> Calificada
              </StatusBadge>
            ) : (
              <StatusBadge tone="warning">
                <AlertTriangle className="size-3" /> En revisión del docente
              </StatusBadge>
            )}
          </div>
        </div>
      </div>

      <SectionCard title="¿Qué sigue?">
        <p className="text-sm text-muted-foreground">
          Las preguntas abiertas las revisa tu docente. El puntaje final aparece en "Mis notas"
          cuando la calificación esté registrada.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="mt-4 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Volver a mis evaluaciones
        </button>
      </SectionCard>
    </>
  );
}
