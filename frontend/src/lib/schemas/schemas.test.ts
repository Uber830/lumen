import { describe, expect, it } from "vitest";

import {
  academicPeriodFormSchema,
  courseFormSchema,
  studentEnrollmentFormSchema,
} from "@/lib/schemas";

describe("academicPeriodFormSchema", () => {
  it("accepts a valid period", () => {
    const result = academicPeriodFormSchema.safeParse({
      name: "1er Trimestre 2026",
      modality: "trimestre",
      start_date: "2026-01-15",
      end_date: "2026-04-15",
      is_current: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects when end_date is before start_date", () => {
    const result = academicPeriodFormSchema.safeParse({
      name: "1er Trimestre 2026",
      modality: "trimestre",
      start_date: "2026-04-15",
      end_date: "2026-01-15",
      is_current: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("end_date"))).toBe(true);
    }
  });

  it("rejects an unknown modality", () => {
    const result = academicPeriodFormSchema.safeParse({
      name: "Foo",
      modality: "cuatrimestre",
      start_date: "2026-01-15",
      end_date: "2026-04-15",
      is_current: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("courseFormSchema", () => {
  it("requires a name and a grade label", () => {
    const result = courseFormSchema.safeParse({ name: "", grade_label: "" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid course", () => {
    const result = courseFormSchema.safeParse({
      name: "10mo A",
      grade_label: "Decimo",
    });
    expect(result.success).toBe(true);
  });
});

describe("studentEnrollmentFormSchema", () => {
  it("requires uuid-shaped ids", () => {
    const result = studentEnrollmentFormSchema.safeParse({
      course_id: "not-a-uuid",
      student_id: "nope",
      status: "active",
    });
    expect(result.success).toBe(false);
  });
});
