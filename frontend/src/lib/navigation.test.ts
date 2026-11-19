import { describe, expect, it } from "vitest";

import { NAV, ROLE_LABEL, ROLE_NOTE, type AppShellRole } from "@/lib/navigation";

/*
 * The menu is part of the contract with the business: the platform role
 * does not administer the plans of the schools, so its menu has no
 * section of plans.
 */

const ROLES: AppShellRole[] = ["super", "admin", "docente", "estudiante"];

describe("el menú de cada rol", () => {
  it("tiene grupos con entradas para todos los roles", () => {
    for (const role of ROLES) {
      expect(NAV[role].length).toBeGreaterThan(0);
      for (const group of NAV[role]) {
        expect(group.label).toBeTruthy();
        expect(group.items.length).toBeGreaterThan(0);
      }
    }
  });

  it("no repite la misma ruta dentro de un rol", () => {
    for (const role of ROLES) {
      const paths = NAV[role].flatMap((group) => group.items.map((item) => item.to));
      expect(new Set(paths).size).toBe(paths.length);
    }
  });

  it("el rol de plataforma no tiene la sección de Planes", () => {
    const paths = NAV.super.flatMap((group) => group.items.map((item) => item.to));
    expect(paths.some((path) => path.includes("planes"))).toBe(false);
    expect(NAV.super.some((group) => group.items.some((item) => item.label === "Planes"))).toBe(
      false,
    );
  });

  it("el rol de plataforma tiene panel, colegios, catálogo y soporte", () => {
    const paths = NAV.super.flatMap((group) => group.items.map((item) => item.to));
    expect(paths).toContain("/super");
    expect(paths).toContain("/super/colegios");
    expect(paths).toContain("/super/catalogo");
    expect(paths).toContain("/super/soporte");
  });

  it("cada rol tiene una nota y una etiqueta", () => {
    for (const role of ROLES) {
      expect(ROLE_NOTE[role]).toBeTruthy();
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });
});
