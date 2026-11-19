import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/theme-toggle";
import { THEME_STORAGE_KEY } from "@/lib/theme";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
  });

  it("renders the same markup the server sent", () => {
    // The stored preference lives in the browser. If the first render
    // read it, the client HTML would differ from the server one (the
    // label and the icon change) and React would report a hydration
    // mismatch.
    const html = renderToString(<ThemeToggle />);

    expect(html).toContain("Tema: Sistema");
    expect(html).not.toContain("Tema: Claro");
  });

  it("picks up the stored preference after the mount", async () => {
    // The other half of the contract: the preference is not ignored,
    // it is applied one tick later.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ThemeToggle />);
    });

    expect(container.innerHTML).toContain("Tema: Claro");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("spells the theme out in the sidebar variant", async () => {
    // The row at the bottom of the sidebar shows the current theme as
    // text: the icon alone is not enough to tell them apart.
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ThemeToggle variant="menu" />);
    });

    expect(container.textContent).toContain("Tema");
    expect(container.textContent).toContain("Claro");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
