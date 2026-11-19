import { describe, expect, it } from "vitest";

import {
  PLAN_CODE_TO_DISPLAY,
  TRIAL_DAYS,
  planCodeSchema,
  signupFormSchema,
} from "@/lib/schemas/signup";

describe("signupFormSchema", () => {
  const valid = {
    schoolName: "Colegio San Martin",
    shortCode: "csm",
    adminFullName: "Ricardo Lema",
    email: "admin@csm.edu",
    password: "supersecret",
    planCode: "estandar" as const,
    acceptTerms: true,
  };

  it("accepts a complete valid payload", () => {
    const result = signupFormSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects a schoolName shorter than 2 chars", () => {
    const result = signupFormSchema.safeParse({ ...valid, schoolName: "A" });
    expect(result.success).toBe(false);
  });

  it("rejects a shortCode with non-allowed characters", () => {
    const result = signupFormSchema.safeParse({ ...valid, shortCode: "c s m" });
    expect(result.success).toBe(false);
  });

  it("rejects a shortCode longer than 16 chars", () => {
    const result = signupFormSchema.safeParse({ ...valid, shortCode: "a".repeat(17) });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    const result = signupFormSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 8 chars", () => {
    const result = signupFormSchema.safeParse({ ...valid, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown planCode", () => {
    const result = signupFormSchema.safeParse({ ...valid, planCode: "diamond" });
    expect(result.success).toBe(false);
  });

  it("rejects acceptTerms=false", () => {
    const result = signupFormSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success).toBe(false);
  });

  it("rejects a missing field", () => {
    const { schoolName: _schoolName, ...rest } = valid;
    void _schoolName;
    const result = signupFormSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

describe("planCodeSchema", () => {
  it("accepts basico, estandar, premium", () => {
    expect(planCodeSchema.safeParse("basico").success).toBe(true);
    expect(planCodeSchema.safeParse("estandar").success).toBe(true);
    expect(planCodeSchema.safeParse("premium").success).toBe(true);
  });

  it("rejects unknown values", () => {
    expect(planCodeSchema.safeParse("trial").success).toBe(false);
    expect(planCodeSchema.safeParse("").success).toBe(false);
  });
});

describe("helpers", () => {
  it("PLAN_CODE_TO_DISPLAY covers all codes", () => {
    expect(PLAN_CODE_TO_DISPLAY.basico).toBe("Basico");
    expect(PLAN_CODE_TO_DISPLAY.estandar).toBe("Estandar");
    expect(PLAN_CODE_TO_DISPLAY.premium).toBe("Premium");
  });

  it("TRIAL_DAYS is positive and within the 1-365 RPC range", () => {
    expect(TRIAL_DAYS).toBeGreaterThan(0);
    expect(TRIAL_DAYS).toBeLessThanOrEqual(365);
  });
});
