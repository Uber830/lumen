import { describe, expect, it } from "vitest";

import {
  chatMessageFormSchema,
  contentItemFormSchema,
  taskFormSchema,
  taskSubmissionFormSchema,
} from "@/lib/schemas";

describe("contentItemFormSchema", () => {
  it("accepts a link with an external URL", () => {
    const result = contentItemFormSchema.safeParse({
      title: "Lectura recomendada",
      kind: "link",
      course_subject_id: "00000000-0000-0000-0000-000000000000",
      external_url: "https://example.com/reading",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a link without an external_url", () => {
    const result = contentItemFormSchema.safeParse({
      title: "Lectura",
      kind: "link",
      course_subject_id: "00000000-0000-0000-0000-000000000000",
      external_url: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a text-only note", () => {
    const result = contentItemFormSchema.safeParse({
      title: "Recordatorio",
      kind: "text",
      course_subject_id: "00000000-0000-0000-0000-000000000000",
      body: "Traer el libro mañana.",
    });
    expect(result.success).toBe(true);
  });
});

describe("taskFormSchema", () => {
  it("accepts a task with a due date", () => {
    const result = taskFormSchema.safeParse({
      title: "TP 1",
      course_subject_id: "00000000-0000-0000-0000-000000000000",
      due_at: "2026-09-01T23:59:00Z",
      max_score: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative max_score", () => {
    const result = taskFormSchema.safeParse({
      title: "TP 1",
      course_subject_id: "00000000-0000-0000-0000-000000000000",
      max_score: -1,
    });
    expect(result.success).toBe(false);
  });
});

describe("taskSubmissionFormSchema", () => {
  it("accepts an empty body (file-only submission)", () => {
    const result = taskSubmissionFormSchema.safeParse({
      body: "",
      status: "submitted",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a graded submission with grade", () => {
    const result = taskSubmissionFormSchema.safeParse({
      body: "Mi entrega",
      status: "graded",
    });
    expect(result.success).toBe(true);
  });
});

describe("chatMessageFormSchema", () => {
  it("rejects empty body", () => {
    const result = chatMessageFormSchema.safeParse({ body: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a non-empty body", () => {
    const result = chatMessageFormSchema.safeParse({ body: "Hola" });
    expect(result.success).toBe(true);
  });
});
