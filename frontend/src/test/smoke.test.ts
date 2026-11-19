import { describe, expect, it } from "vitest";

import { cn } from "@/lib/utils";

describe("cn utility", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("filters out falsy values", () => {
    expect(cn("a", undefined, false, null, 0, "", "b")).toBe("a b");
  });

  it("handles conditional classes from objects", () => {
    expect(cn("base", { active: true, disabled: false })).toBe("base active");
  });

  it("later class names win for conflicts via tailwind-merge", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});
