import { describe, expect, it } from "vitest";

import { answerFromRow, answerPayload } from "@/features/student/use-evaluations";
import { formatCountdown } from "@/features/student/use-countdown";
import { safeFileName } from "@/lib/storage/files";
import type { EvaluationAnswer } from "@/lib/api/types";

/**
 * The contract between the runner and the API.
 *
 * The API takes exactly one shape per answer: a multiple choice answer
 * carries the index of the option, a true/false answer carries the
 * value, and an open answer carries the text. Sending two of them, or
 * none, is rejected by the backend.
 */
describe("the answer payload", () => {
  it("sends only the index of the chosen option", () => {
    expect(answerPayload("q1", { kind: "multiple_choice", index: 2 })).toEqual({
      question_id: "q1",
      closed_answer: 2,
    });
  });

  it("sends only the value of a true/false answer", () => {
    expect(answerPayload("q1", { kind: "true_false", value: false })).toEqual({
      question_id: "q1",
      closed_boolean: false,
    });
  });

  it("sends only the text of an open answer", () => {
    expect(answerPayload("q1", { kind: "open", text: "La respuesta" })).toEqual({
      question_id: "q1",
      text_answer: "La respuesta",
    });
  });
});

/** A stored answer, as the API returns it. */
function storedAnswer(changes: Partial<EvaluationAnswer>): EvaluationAnswer {
  return {
    id: "a1",
    school_id: "s1",
    attempt_id: "at1",
    question_id: "q1",
    closed_answer: null,
    closed_boolean: null,
    text_answer: null,
    points_awarded: null,
    graded_by: null,
    graded_at: null,
    feedback: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...changes,
  };
}

describe("the answer of a saved attempt", () => {
  it("restores the chosen option", () => {
    expect(answerFromRow(storedAnswer({ closed_answer: 3 }))).toEqual({
      kind: "multiple_choice",
      index: 3,
    });
  });

  it("restores the value of a true/false answer", () => {
    expect(answerFromRow(storedAnswer({ closed_boolean: true }))).toEqual({
      kind: "true_false",
      value: true,
    });
  });

  it("restores the text of an open answer", () => {
    expect(answerFromRow(storedAnswer({ text_answer: "Porque si" }))).toEqual({
      kind: "open",
      text: "Porque si",
    });
  });

  it("has no answer when the student did not answer", () => {
    expect(answerFromRow(storedAnswer({}))).toBeNull();
  });

  it("keeps the option zero, which is a real answer", () => {
    expect(answerFromRow(storedAnswer({ closed_answer: 0 }))).toEqual({
      kind: "multiple_choice",
      index: 0,
    });
  });
});

describe("the clock of an attempt", () => {
  it("shows the minutes and the seconds", () => {
    expect(formatCountdown(42 * 60 + 18)).toBe("42:18");
  });

  it("pads the seconds", () => {
    expect(formatCountdown(65)).toBe("1:05");
  });

  it("shows a dash when the attempt has no limit", () => {
    expect(formatCountdown(null)).toBe("—");
  });
});

describe("the name of an uploaded file", () => {
  it("keeps the extension and drops the accents", () => {
    expect(safeFileName("Tesis de grado Ñoño.pdf")).toBe("Tesis-de-grado-Nono.pdf");
  });

  it("replaces the characters the storage path does not accept", () => {
    expect(safeFileName("entrega final (1).docx")).toBe("entrega-final-1-.docx");
  });

  it("falls back to a name when there is nothing usable", () => {
    expect(safeFileName("...")).toBe("archivo");
  });
});
