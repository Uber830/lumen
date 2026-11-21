import { describe, expect, it } from "vitest";

import { NAV, isCurrentPath, type AppShellRole } from "@/lib/navigation";

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
});

describe("la entrada que es la página actual", () => {
  it("marca solo la página exacta", () => {
    expect(isCurrentPath("/super", "/super")).toBe(true);
    expect(isCurrentPath("/super/colegios", "/super/colegios")).toBe(true);
  });

  it("no marca a la entrada padre cuando se está en una hija", () => {
    // Con una comparación por prefijo, «Panel global» seguía pintado
    // al abrir «Colegios»: parecían dos entradas seleccionadas.
    expect(isCurrentPath("/super/colegios", "/super")).toBe(false);
    expect(isCurrentPath("/super/catalogo", "/super")).toBe(false);
    expect(isCurrentPath("/super/soporte", "/super")).toBe(false);
    expect(isCurrentPath("/admin/docentes", "/admin")).toBe(false);
    expect(isCurrentPath("/docente/materia", "/docente")).toBe(false);
  });

  it("no marca a una entrada hermana", () => {
    expect(isCurrentPath("/super/catalogo", "/super/colegios")).toBe(false);
    expect(isCurrentPath("/admin/icfes", "/admin/icfes-simulacros")).toBe(false);
  });
});
