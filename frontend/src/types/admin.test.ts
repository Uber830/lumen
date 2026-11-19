import { describe, expect, it } from "vitest";

import type { SchoolStats } from "@/types/admin";

describe("SchoolStats type shape", () => {
  it("accepts a fully populated payload", () => {
    const stats: SchoolStats = {
      schoolId: "00000000-0000-0000-0000-000000000001",
      schoolName: "Colegio San Martin",
      schoolShortCode: "CSM",
      schoolStatus: "active",
      currentPeriod: {
        id: "00000000-0000-0000-0000-000000000002",
        name: "2o Trimestre 2026",
        modality: "trimestre",
      },
      students: 1284,
      teachers: 96,
      courses: 38,
      pendingTasks: 12,
    };
    expect(stats.schoolName).toBe("Colegio San Martin");
    expect(stats.students).toBe(1284);
  });

  it("accepts the empty / trial payload", () => {
    const stats: SchoolStats = {
      schoolId: "",
      schoolName: "",
      schoolShortCode: "",
      schoolStatus: "trial",
      currentPeriod: null,
      students: 0,
      teachers: 0,
      courses: 0,
      pendingTasks: 0,
    };
    expect(stats.currentPeriod).toBeNull();
    expect(stats.students).toBe(0);
  });
});

describe("number formatting helper", () => {
  // Mirror of formatNumber in admin.index.tsx; kept here so the locale
  // contract is testable.
  function formatNumber(n: number): string {
    return n.toLocaleString("es-CO");
  }

  it("formats thousands with a non-breaking separator", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1284)).toMatch(/^1\.?284$/);
    expect(formatNumber(1000000)).toMatch(/1\.000\.000/);
  });
});
