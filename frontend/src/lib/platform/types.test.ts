import { describe, expect, it } from "vitest";

import {
  MATERIAL_STATUS_LABEL,
  MATERIAL_STATUS_TONE,
  type MaterialStatus,
} from "@/lib/platform/types";

/*
 * The labels and the tones of the states are part of the contract with
 * the backend: a state that the API names must have its own name in
 * the panel and a tone of its own.
 */

const STATES: MaterialStatus[] = ["draft", "review", "published", "archived"];

describe("the states of the catalog", () => {
  it("has a name for every state", () => {
    for (const state of STATES) {
      expect(MATERIAL_STATUS_LABEL[state]).toBeTruthy();
    }
  });

  it("has a different tone for every state", () => {
    const tones = STATES.map((state) => MATERIAL_STATUS_TONE[state]);
    expect(new Set(tones).size).toBe(STATES.length);
  });

  it("names the states in Spanish", () => {
    expect(MATERIAL_STATUS_LABEL.draft).toBe("Borrador");
    expect(MATERIAL_STATUS_LABEL.review).toBe("En revisión");
    expect(MATERIAL_STATUS_LABEL.published).toBe("Publicado");
    expect(MATERIAL_STATUS_LABEL.archived).toBe("Archivado");
  });
});
