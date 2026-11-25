import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it } from "vitest";

import {
  getCollapsedSidebar,
  setCollapsedSidebar,
  SIDEBAR_STORAGE_KEY,
  subscribeSidebar,
  useCollapsedSidebar,
} from "@/lib/sidebar";

// React needs to know it is running inside a test to allow `act`.
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("the shape of the left rail", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts expanded", () => {
    expect(getCollapsedSidebar()).toBe(false);
  });

  it("remembers the choice in the browser", () => {
    setCollapsedSidebar(true);

    expect(localStorage.getItem(SIDEBAR_STORAGE_KEY)).toBe("1");
    expect(getCollapsedSidebar()).toBe(true);
  });

  it("tells the subscribers that the rail changed", () => {
    let calls = 0;
    const unsubscribe = subscribeSidebar(() => {
      calls += 1;
    });

    setCollapsedSidebar(true);
    setCollapsedSidebar(false);
    unsubscribe();
    setCollapsedSidebar(true);

    expect(calls).toBe(2);
  });

  it("picks up the stored preference after the mount", async () => {
    // The server always sends the rail expanded: the client reads the
    // preference once it is mounted, so the two never disagree.
    localStorage.setItem(SIDEBAR_STORAGE_KEY, "1");

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let value = false;

    function Probe() {
      const [collapsed] = useCollapsedSidebar();
      value = collapsed;
      return null;
    }

    await act(async () => {
      root.render(<Probe />);
    });

    expect(value).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
