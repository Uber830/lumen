import { describe, expect, it } from "vitest";

import {
  auditEventLabel,
  CASE_CHANNEL_LABEL,
  CASE_LEVEL_LABEL,
  CASE_LEVEL_TONE,
  CASE_STATUS_LABEL,
  CASE_STATUS_TONE,
  MATERIAL_STATUS_LABEL,
  MATERIAL_STATUS_TONE,
  type CaseLevel,
  type CaseStatus,
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

/*
 * The support desk has its own vocabularies: the levels, the states and
 * the channels come from the API, and every one of them needs a name
 * and a tone in the panel.
 */

const LEVELS: CaseLevel[] = ["info", "aviso", "urgente"];
const CASE_STATUSES: CaseStatus[] = ["abierto", "en_espera", "resuelto"];

describe("the desk of the support", () => {
  it("has a name and a tone for every level", () => {
    for (const level of LEVELS) {
      expect(CASE_LEVEL_LABEL[level]).toBeTruthy();
      expect(CASE_LEVEL_TONE[level]).toBeTruthy();
    }
    expect(new Set(LEVELS.map((level) => CASE_LEVEL_TONE[level])).size).toBe(LEVELS.length);
  });

  it("has a name and a tone for every state of a case", () => {
    for (const status of CASE_STATUSES) {
      expect(CASE_STATUS_LABEL[status]).toBeTruthy();
      expect(CASE_STATUS_TONE[status]).toBeTruthy();
    }
    expect(new Set(CASE_STATUSES.map((status) => CASE_STATUS_TONE[status])).size).toBe(
      CASE_STATUSES.length,
    );
  });

  it("names the channels in Spanish", () => {
    expect(CASE_CHANNEL_LABEL.formulario_web).toBe("Formulario web");
    expect(CASE_CHANNEL_LABEL.correo).toBe("Correo");
    expect(CASE_CHANNEL_LABEL.llamada).toBe("Llamada");
  });

  it("reads a movement of the platform in plain words", () => {
    expect(auditEventLabel("school.access_granted")).toBe("Acceso al material habilitado");
    // A movement that the panel does not know keeps its own name.
    expect(auditEventLabel("algo.nuevo")).toBe("algo.nuevo");
  });
});
