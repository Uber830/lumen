import { describe, expect, it } from "vitest";

import { primaryColorStyle } from "@/lib/school/theme";

describe("primaryColorStyle", () => {
  it("paints the theme variables of the school", () => {
    const css = primaryColorStyle("oklch(0.55 0.16 240)");

    // `html:root` is more specific than the `.dark` block of the
    // stylesheet, so the school's colour wins in both modes.
    expect(css).toContain("html:root");
    expect(css).toContain("--primary: oklch(0.55 0.16 240);");
    expect(css).toContain("--ring: oklch(0.55 0.16 240);");
    expect(css).toContain("--sidebar-primary: oklch(0.55 0.16 240);");
    // The soft tint is derived from the same colour.
    expect(css).toContain("--primary-soft: oklch(0.95 0.029 240);");
  });

  it("paints nothing without a colour", () => {
    expect(primaryColorStyle(null)).toBe("");
  });
});
