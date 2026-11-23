import { describe, expect, it } from "vitest";

import { primaryColorStyle } from "@/lib/school/theme";

describe("primaryColorStyle", () => {
  it("paints the theme variables of the school", () => {
    const css = primaryColorStyle("oklch(0.55 0.16 240)");

    // `html:root` is more specific than the `.dark` block of the
    // stylesheet, so the school's colour wins in both modes.
    expect(css).toContain("html:root");
    // The colour is written in `--school-primary`: the panel derives
    // `--primary`, the ring and the accent of the rail from it.
    expect(css).toContain("--school-primary: oklch(0.55 0.16 240);");
    // The soft tint is derived from the same colour.
    expect(css).toContain("--school-primary-soft: oklch(0.95 0.029 240);");
  });

  it("paints nothing without a colour", () => {
    expect(primaryColorStyle(null)).toBe("");
  });
});
