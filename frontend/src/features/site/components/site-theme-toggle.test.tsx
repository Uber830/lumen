import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { SiteThemeToggle } from "@/features/site/components/site-theme-toggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<SiteThemeToggle />);
  });

  const button = container.querySelector("button")!;
  return {
    button,
    label: () => button.getAttribute("aria-label") ?? "",
    async click() {
      await act(async () => {
        button.click();
      });
    },
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe("SiteThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("cycles through the three preferences", async () => {
    const { label, click, cleanup } = await render();

    expect(label()).toContain("Sistema");

    await click();
    expect(label()).toContain("Claro");

    await click();
    expect(label()).toContain("Oscuro");

    await cleanup();
  });

  it("applies and remembers the choice", async () => {
    const { click, cleanup } = await render();

    await click();
    await click();

    // The dark theme is on, and it survives a reload.
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    await cleanup();
  });

  it("says which theme it is, not only with an icon", async () => {
    const { label, cleanup } = await render();

    expect(label()).toContain("Tema:");
    expect(label()).toContain("Cambiar el tema.");

    await cleanup();
  });
});
