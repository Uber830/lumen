// =============================================================================
// The student's evaluations.
// -----------------------------------------------------------------------------
// An evaluation is authored by a teacher on a course subject. The student
// sees the published ones, starts an attempt, answers the questions and
// submits it.
//
// The answer keys never reach the browser: the backend scores the attempt
// when it is submitted, and the student only ever reads their own score.
// This module sends answers and reads results; it never decides a grade.
// =============================================================================

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "@/lib/api/client";
import type { CourseSubjectSummary } from "@/features/academics/types";
import type {
  Evaluation,
  EvaluationAnswer,
  EvaluationAttempt,
  EvaluationQuestion,
} from "@/lib/api/types";

export const evaluationKeys = {
  list: (schoolId: string) => ["evaluations", "student", schoolId] as const,
  questions: (evaluationId: string) => ["evaluations", "questions", evaluationId] as const,
  answers: (attemptId: string) => ["evaluations", "answers", attemptId] as const,
};

/** One evaluation, with the names of its course subject and my attempt. */
export type StudentEvaluation = Evaluation & {
  subject_name: string;
  course_name: string;
  attempt: EvaluationAttempt | null;
};

/**
 * The evaluations the student may take, with their own attempt.
 *
 * The API already hides the draft evaluations and the attempts of the
 * other students; the join with the course subjects only adds the
 * names the list renders.
 */
export function useStudentEvaluations(
  schoolId: string | null,
  studentId: string | null,
): UseQueryResult<StudentEvaluation[], Error> {
  return useQuery({
    queryKey: schoolId ? evaluationKeys.list(schoolId) : ["evaluations", "student", "none"],
    enabled: !!schoolId && !!studentId,
    queryFn: async () => {
      const [evaluations, attempts, courseSubjects] = await Promise.all([
        api.get<Evaluation[]>("/v1/evaluations"),
        api.get<EvaluationAttempt[]>("/v1/evaluations/attempts"),
        api.get<CourseSubjectSummary[]>("/v1/academics/course-subjects"),
      ]);

      const labels = new Map(
        courseSubjects.map((courseSubject) => [courseSubject.id, courseSubject]),
      );
      const attemptsByEvaluation = new Map(
        attempts.map((attempt) => [attempt.evaluation_id, attempt]),
      );

      return evaluations.map((evaluation) => {
        const label = labels.get(evaluation.course_subject_id);
        return {
          ...evaluation,
          subject_name: label?.subject_name ?? "Materia",
          course_name: label?.course_name ?? "",
          attempt: attemptsByEvaluation.get(evaluation.id) ?? null,
        };
      });
    },
  });
}

/** The questions of an evaluation. They never carry the answer key. */
export function useEvaluationQuestions(
  evaluationId: string | null,
): UseQueryResult<EvaluationQuestion[], Error> {
  return useQuery({
    queryKey: evaluationId
      ? evaluationKeys.questions(evaluationId)
      : ["evaluations", "questions", "none"],
    enabled: !!evaluationId,
    queryFn: () => api.get<EvaluationQuestion[]>(`/v1/evaluations/${evaluationId}/questions`),
  });
}

/** The answers the student already saved in an attempt. */
export function useAttemptAnswers(
  attemptId: string | null,
): UseQueryResult<EvaluationAnswer[], Error> {
  return useQuery({
    queryKey: attemptId ? evaluationKeys.answers(attemptId) : ["evaluations", "answers", "none"],
    enabled: !!attemptId,
    queryFn: () => api.get<EvaluationAnswer[]>(`/v1/evaluations/attempts/${attemptId}/answers`),
  });
}

/**
 * Start an attempt.
 *
 * Idempotent on the server: a student who reloads the page keeps the
 * attempt they already had.
 */
export function useStartEvaluationAttempt(): UseMutationResult<EvaluationAttempt, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (evaluationId: string) =>
      api.post<EvaluationAttempt>(`/v1/evaluations/${evaluationId}/attempts`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

/** The shape of an answer, one per question kind. */
export type EvaluationAnswerInput =
  | { kind: "multiple_choice"; index: number }
  | { kind: "true_false"; value: boolean }
  | { kind: "open"; text: string };

/**
 * The body the API expects for an answer.
 *
 * The API takes exactly one of the three shapes, so the answer kind
 * decides which one is sent.
 */
export function answerPayload(questionId: string, answer: EvaluationAnswerInput) {
  switch (answer.kind) {
    case "multiple_choice":
      return { question_id: questionId, closed_answer: answer.index };
    case "true_false":
      return { question_id: questionId, closed_boolean: answer.value };
    case "open":
      return { question_id: questionId, text_answer: answer.text };
  }
}

/** Save one answer of an attempt. */
export function useSaveEvaluationAnswer(): UseMutationResult<
  EvaluationAnswer,
  Error,
  { attemptId: string; questionId: string; answer: EvaluationAnswerInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, questionId, answer }) =>
      api.post<EvaluationAnswer>(
        `/v1/evaluations/attempts/${attemptId}/answers`,
        answerPayload(questionId, answer),
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: evaluationKeys.answers(vars.attemptId) });
    },
  });
}

/** Clear one answer of an attempt. */
export function useClearEvaluationAnswer(): UseMutationResult<
  void,
  Error,
  { attemptId: string; questionId: string }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ attemptId, questionId }) =>
      api.delete<void>(`/v1/evaluations/attempts/${attemptId}/answers/${questionId}`),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: evaluationKeys.answers(vars.attemptId) });
    },
  });
}

/** Submit an attempt. The backend scores it and returns the score. */
export function useSubmitEvaluationAttempt(): UseMutationResult<EvaluationAttempt, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attemptId: string) =>
      api.post<EvaluationAttempt>(`/v1/evaluations/attempts/${attemptId}/submit`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

/** The answer of a question, as it was stored. */
export function answerFromRow(row: EvaluationAnswer): EvaluationAnswerInput | null {
  if (row.closed_answer !== null && row.closed_answer !== undefined) {
    return { kind: "multiple_choice", index: Number(row.closed_answer) };
  }
  if (row.closed_boolean !== null && row.closed_boolean !== undefined) {
    return { kind: "true_false", value: row.closed_boolean };
  }
  if (row.text_answer !== null && row.text_answer !== undefined && row.text_answer !== "") {
    return { kind: "open", text: row.text_answer };
  }
  return null;
}
