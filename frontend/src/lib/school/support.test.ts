import { describe, expect, it } from "vitest";

import { openCaseCount, type SupportCaseSummary } from "@/lib/school/support";

/**
 * The counter of the rail: how many requests of the school are still
 * open.
 *
 * A resolved case is not work that is waiting: it leaves the counter.
 */
describe("the counter of the open cases", () => {
  const caseOf = (status: string): SupportCaseSummary => ({
    id: "1",
    code: "SOL-1043",
    title: "Los docentes no ven el material",
    category: "problema_tecnico",
    channel: "formulario_colegio",
    level: "aviso",
    status,
    opened_at: "2026-11-14T09:15:00Z",
    opened_by: null,
    opened_by_name: "Ana Restrepo",
    messages: 2,
  });

  it("counts the cases that are not resolved", () => {
    expect(openCaseCount([caseOf("abierto"), caseOf("en_espera"), caseOf("resuelto")])).toBe(2);
  });

  it("is zero when there are no cases", () => {
    expect(openCaseCount([])).toBe(0);
  });

  it("does not fail when the list did not arrive", () => {
    expect(openCaseCount(undefined)).toBe(0);
  });
});
